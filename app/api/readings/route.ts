import { NextRequest, NextResponse, after } from 'next/server';
import { checkAlerts } from '@/lib/alerts';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { fetchReadings } from '@/lib/readings';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);

// ESP8266 envia a leitura (autenticado por x-device-key)
export async function POST(req: NextRequest) {
  if (req.headers.get('x-device-key') !== process.env.DEVICE_KEY)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const temperature = num(b?.temperature), humidity = num(b?.humidity);
  const id = typeof b?.device_id === 'string' ? b.device_id.trim() : '';
  if (!id || id.length > 64 || temperature === null || humidity === null)
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  // Cidade (código da OpenWeatherMap, ex.: 3463011); aceita número ou texto numérico
  const cid = Number(b.city_id);
  const cityId = Number.isInteger(cid) && cid > 0 ? cid : null;
  const cityName = typeof b.city_name === 'string' && b.city_name.trim() ? b.city_name.trim().slice(0, 80) : null;

  const fields = {
    ip: typeof b.ip === 'string' && /^[0-9a-fA-F:.]{3,45}$/.test(b.ip) ? b.ip : null, rssi: num(b.rssi), battery: num(b.battery),
    battery_voltage: num(b.battery_voltage),
    battery_active: typeof b.battery_active === 'boolean' ? b.battery_active : num(b.battery) !== null,
    firmware: b.firmware ?? null, last_temperature: temperature,
    last_humidity: humidity, last_seen: new Date().toISOString(),
    ...(cityId ? { city_id: cityId, city_name: cityName } : {}),
  };

  // Atualiza o ESP; se o ID ainda não existe, cadastra automaticamente (sem dono, nome e descrição em branco)
  const { data: dev, error: e1 } = await supabase.from('devices').update(fields).eq('id', id).select('id, name');
  if (e1) return NextResponse.json({ error: 'db error' }, { status: 500 });
  if (!dev?.length) {
    const { error: e3 } = await supabase.from('devices').insert({ id, name: '', description: null, ...fields });
    if (e3) return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  const { error: e2 } = await supabase.from('readings')
    .insert({ device_id: id, temperature, humidity, city_id: cityId, city_name: cityName });
  if (e2) return NextResponse.json({ error: 'db error' }, { status: 500 });

  // Alertas push: roda depois de responder ao ESP, sem atrasá-lo
  after(() => checkAlerts(id, dev?.[0]?.name ?? '', {
    temperature, humidity, battery: fields.battery, battery_active: fields.battery_active,
  }).catch(e => console.error('alerts', e)));

  if (cityId)
    await supabase.from('device_cities').upsert(
      { device_id: id, city_id: cityId, city_name: cityName, last_seen: fields.last_seen },
      { onConflict: 'device_id,city_id' });
  return NextResponse.json({ ok: true });
}

// Painel consulta as leituras de um ESP (e, opcionalmente, de uma cidade)
export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const device = req.nextUrl.searchParams.get('device');
  if (!device) return NextResponse.json({ error: 'device required' }, { status: 400 });
  if (!(await canAccessDevice(u, device))) return forbidden();
  const city = Number(req.nextUrl.searchParams.get('city')) || null;
  const hours = Math.min(Number(req.nextUrl.searchParams.get('hours')) || 24, 720);
  const rows = await fetchReadings(device, hours, city);
  if (!rows) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(rows);
}
