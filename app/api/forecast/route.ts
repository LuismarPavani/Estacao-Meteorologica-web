import { NextRequest, NextResponse } from 'next/server';
import { cityLocation, parseCity } from '@/lib/city';
import { getForecast } from '@/lib/owm';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Previsão da cidade (mesma regra do /api/weather: coordenadas do ESP quando houver, senão o código)
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
  const { status, body } = await getForecast(loc, data.owm_key);
  return NextResponse.json(body, { status });
}
