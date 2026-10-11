import { NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Chave pública VAPID (lida na hora, sem precisar refazer o build)
export async function GET() {
  if (!(await getUser())) return unauthorized();
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
}
