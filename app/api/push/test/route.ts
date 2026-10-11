import { NextResponse } from 'next/server';
import { pushEnabled, sendToUser } from '@/lib/push';
import { getUser, unauthorized } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const u = await getUser();
  if (!u) return unauthorized();
  if (!pushEnabled()) return NextResponse.json({ error: 'push_not_configured' }, { status: 503 });
  const sent = await sendToUser(u.id, {
    title: 'Notificação de teste', body: 'As notificações estão funcionando neste aparelho.', url: '/account',
  });
  return NextResponse.json({ sent });
}
