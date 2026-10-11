import { NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Regras de alerta do usuário logado (uma por ESP)
export async function GET() {
  const u = await getUser();
  if (!u) return unauthorized();
  const { data, error } = await supabase.from('alert_rules').select('*').eq('user_id', u.id);
  if (error) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(data);
}
