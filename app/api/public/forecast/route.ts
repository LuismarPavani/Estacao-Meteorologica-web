import { NextRequest, NextResponse } from 'next/server';
import { cityLocation, parseCity } from '@/lib/city';
import { getForecast } from '@/lib/owm';
import { publicCityAllowed, publicOwmKey } from '@/lib/public';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const city = parseCity(req.nextUrl.searchParams.get('city'));
  const device = req.nextUrl.searchParams.get('device') ?? '';
  if (city === null || !device || !(await publicCityAllowed(device, city)))
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  const loc = await cityLocation(device, city);
  if (!loc) return NextResponse.json({ error: 'no_location' }, { status: 400 });
  const key = await publicOwmKey();
  if (!key) { console.warn('public forecast: nenhuma chave da OpenWeatherMap cadastrada'); return NextResponse.json({ error: 'no_key' }, { status: 400 }); }
  const { status, body } = await getForecast(loc, key);
  if (status !== 200) console.warn('public forecast:', status, (body as { error?: string }).error);
  return NextResponse.json(body, { status });
}
