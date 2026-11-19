import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { COOKIE, createSession } from '@/lib/auth';
import { ipDe, limpaFalhas, minutosBloqueado, registraFalha } from '@/lib/loginLimit';
import { checkPassword, hashPassword } from '@/lib/password';
import { isRootUser } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Compara as senhas sem vazar, pelo tempo de resposta, quantos caracteres estavam certos
function igual(a: string, b: string | undefined) {
  if (!b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const { user, password } = await req.json();
  const username = String(user ?? '').trim().toLowerCase().slice(0, 64);
  const bad = () => NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  if (!username || !password) return bad();

  // Muitas senhas erradas deste IP: recusa antes de conferir a senha (até a certa), senão o
  // bloqueio não impediria quem está tentando adivinhar
  const ip = ipDe(req);
  const espera = await minutosBloqueado(username, ip);
  if (espera > 0) {
    return NextResponse.json(
      { error: `Muitas tentativas erradas. Tente de novo em ${espera} min.` },
      { status: 429, headers: { 'Retry-After': String(espera * 60) } });
  }

  let uid: string | null = null;
  // Usuário principal (ADMIN_USER / ADMIN_PASSWORD): sempre admin, criado ou restaurado no login.
  // Serve de acesso de emergência se alguém esquecer a senha.
  if (isRootUser(username) && igual(String(password), process.env.ADMIN_PASSWORD)) {
    const { data } = await supabase.from('users')
      .upsert({ username, password_hash: hashPassword(password), role: 'admin' }, { onConflict: 'username' })
      .select('id').single();
    uid = data?.id ?? null;
  } else {
    const { data } = await supabase.from('users').select('id, password_hash').eq('username', username).maybeSingle();
    if (data && checkPassword(String(password), data.password_hash)) uid = data.id;
  }
  if (!uid) { await registraFalha(username, ip); return bad(); }

  await limpaFalhas(username, ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createSession(uid), {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
