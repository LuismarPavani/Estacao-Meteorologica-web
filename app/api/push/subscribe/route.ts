import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getUser();
  if (!u) return unauthorized();
  const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
  return NextResponse.json({ count: count ?? 0 });
}

// Registra este aparelho para receber notificações
export async function POST(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const { subscription: s, userAgent } = await req.json();
  const endpoint = s?.endpoint, p256dh = s?.keys?.p256dh, auth = s?.keys?.auth;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string')
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: u.id, endpoint, p256dh, auth, user_agent: String(userAgent ?? '').slice(0, 300) },
    { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const { endpoint } = await req.json();
  await supabase.from('push_subscriptions').delete().eq('user_id', u.id).eq('endpoint', String(endpoint ?? ''));
  return NextResponse.json({ ok: true });
}
