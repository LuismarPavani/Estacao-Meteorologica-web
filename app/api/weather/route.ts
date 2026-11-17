import { NextRequest, NextResponse } from 'next/server';
import { cityLocation, parseCity } from '@/lib/city';
import { getWeather } from '@/lib/owm';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Clima atual da cidade, usando a chave da OpenWeatherMap do usuário logado (a chave nunca vai ao navegador).
// Com ?device=, usa as coordenadas que o ESP enviou para essa cidade (ou o código, se não houver coordenadas).
export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const city = parseCity(req.nextUrl.searchParams.get('city'));
  if (city === null) return NextResponse.json({ error: 'city required' }, { status: 400 });
  const device = req.nextUrl.searchParams.get('device');
  if (device && !(await canAccessDevice(u, device))) return forbidden();
  const loc = await cityLocation(device, city);
  if (!loc) return NextResponse.json({ error: 'no_location' }, { status: 400 });
  const { data } = await supabase.from('users').select('owm_key').eq('id', u.id).single();
  if (!data?.owm_key) return NextResponse.json({ error: 'no_key' }, { status: 400 });
  const { status, body } = await getWeather(loc, data.owm_key);
  return NextResponse.json(body, { status });
}
