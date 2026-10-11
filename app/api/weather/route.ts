import { NextRequest, NextResponse } from 'next/server';
import { getWeather } from '@/lib/owm';
import { getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Clima atual da cidade, usando a chave da OpenWeatherMap do usuário logado (a chave nunca vai ao navegador)
export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const city = Number(req.nextUrl.searchParams.get('city'));
  if (!Number.isInteger(city) || city <= 0) return NextResponse.json({ error: 'city required' }, { status: 400 });
  const { data } = await supabase.from('users').select('owm_key').eq('id', u.id).single();
  if (!data?.owm_key) return NextResponse.json({ error: 'no_key' }, { status: 400 });
  const { status, body } = await getWeather(city, data.owm_key);
  return NextResponse.json(body, { status });
}
