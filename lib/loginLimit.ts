import { supabase } from './supabase';

// Limite de tentativas de login, guardado no banco (tabela login_failures, migration-v6.sql): no Vercel
// cada requisição pode cair numa instância diferente, então a memória do servidor não serve para contar.
// Bloqueia por JANELA_MIN minutos quando há, nessa janela:
//   - MAX_USUARIO_IP senhas erradas para o mesmo usuário vindas do mesmo IP (quem erra a própria senha);
//   - MAX_IP senhas erradas vindas do mesmo IP, para qualquer usuário (quem testa vários usuários).
// O bloqueio é por IP, para que alguém de fora não consiga trancar o admin só errando a senha dele.
export const JANELA_MIN = 15;
export const MAX_USUARIO_IP = 5;
export const MAX_IP = 20;
const JANELA_MS = JANELA_MIN * 60000;

/** IP de quem chamou. No Vercel, x-real-ip e o primeiro x-forwarded-for vêm do próprio Vercel. */
export function ipDe(req: Request) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? '';
  return ip.trim().slice(0, 64) || 'desconhecido';
}

// Horários (ms) das falhas recentes, da mais nova para a mais velha; null se a tabela não existir
async function falhas(filtro: { username?: string; ip: string }, limite: number): Promise<number[] | null> {
  let q = supabase.from('login_failures').select('at')
    .eq('ip', filtro.ip).gte('at', new Date(Date.now() - JANELA_MS).toISOString())
    .order('at', { ascending: false }).limit(limite);
  if (filtro.username !== undefined) q = q.eq('username', filtro.username);
  const { data, error } = await q;
  if (error) { console.warn('login: limite de tentativas desligado (rode o migration-v6.sql):', error.message); return null; }
  return data.map(r => Date.parse(r.at as string));
}

/**
 * Minutos que ainda faltam para liberar o login (0 = liberado). Se o banco não tiver a tabela,
 * libera (o login não pode parar por causa do limite) e avisa no log do Vercel.
 */
export async function minutosBloqueado(username: string, ip: string): Promise<number> {
  const [porUsuario, porIp] = await Promise.all([
    falhas({ username, ip }, MAX_USUARIO_IP),
    falhas({ ip }, MAX_IP),
  ]);
  // Libera quando a falha que completou o limite sair da janela
  const ate = (l: number[] | null, max: number) => (l && l.length >= max ? l[max - 1] + JANELA_MS : 0);
  const fim = Math.max(ate(porUsuario, MAX_USUARIO_IP), ate(porIp, MAX_IP));
  return fim > Date.now() ? Math.ceil((fim - Date.now()) / 60000) : 0;
}

/** Registra uma senha errada e apaga as falhas com mais de 1 dia (a tabela fica sempre pequena). */
export async function registraFalha(username: string, ip: string) {
  await supabase.from('login_failures').insert({ username: username.slice(0, 64), ip });
  await supabase.from('login_failures').delete().lt('at', new Date(Date.now() - 86400000).toISOString());
}

/** Login certo: zera as falhas desse usuário nesse IP. */
export async function limpaFalhas(username: string, ip: string) {
  await supabase.from('login_failures').delete().eq('username', username).eq('ip', ip);
}
