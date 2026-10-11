import { NextRequest, NextResponse } from 'next/server';
import { getWeather } from '@/lib/owm';
import { publicCityAllowed, publicOwmKey } from '@/lib/public';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const city = Number(req.nextUrl.searchParams.get('city'));
  const device = req.nextUrl.searchParams.get('device') ?? '';
  if (!Number.isInteger(city) || city <= 0 || !device || !(await publicCityAllowed(device, city)))
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  const key = await publicOwmKey();
  if (!key) { console.warn('public weather: nenhuma chave da OpenWeatherMap cadastrada'); return NextResponse.json({ error: 'no_key' }, { status: 400 }); }
  const { status, body } = await getWeather(city, key);
  if (status !== 200) console.warn('public weather:', status, (body as { error?: string }).error);
  return NextResponse.json(body, { status });
}
