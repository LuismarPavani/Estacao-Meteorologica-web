import { NextRequest, NextResponse, after } from 'next/server';
import { AlertEvent, checkAlerts } from '@/lib/alerts';
import { readingSchema } from '@/lib/readingSchema';
import { fetchReadings } from '@/lib/readings';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ABNORMAL_RESET = /exception|watchdog/i;

// ESP8266 envia a leitura (autenticado por x-device-key)
export async function POST(req: NextRequest) {
  if (req.headers.get('x-device-key') !== process.env.DEVICE_KEY)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = readingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({
      error: 'invalid payload',
      details: parsed.error.issues.map(i => `${i.path.join('.') || 'corpo'}: ${i.message}`),
    }, { status: 400 });
  const b = parsed.data;
  const id = b.device_id;
  const cityId = b.city_id ?? null;
  const cityName = b.city_name?.trim().slice(0, 80) || null;
  const sensorOk = b.sensor_ok !== false; // campo ausente = ok

  // Estado anterior do ESP: serve para detectar eventos (queda de energia, sensor, reinício)
  const { data: prev } = await supabase.from('devices')
    .select('name, external_power, sensor_ok, uptime_s').eq('id', id).maybeSingle();

  const now = new Date().toISOString();
  const fields = {
    ip: b.ip && /^[0-9a-fA-F:.]{3,45}$/.test(b.ip) ? b.ip : null,
    rssi: b.rssi !== undefined && b.rssi <= 0 ? b.rssi : null, // o ESP8266 devolve 31 quando está sem Wi-Fi
    battery: b.battery ?? null, battery_voltage: b.battery_voltage ?? null,
    battery_active: b.battery_active ?? b.battery !== undefined,
    firmware: b.firmware ?? null, last_seen: now,
    external_power: b.external_power ?? null, sensor_ok: b.sensor_ok ?? null,
    uptime_s: b.uptime_s ?? null, reset_reason: b.reset_reason ?? null, free_heap: b.free_heap ?? null,
    chip_id: b.chip_id ?? null, send_interval_s: b.send_interval_s ?? null, display_on: b.display_on ?? null,
    // Sensor com defeito envia 0.0: não sobrescreve a última leitura boa
    ...(sensorOk ? { last_temperature: b.temperature, last_humidity: b.humidity } : {}),
    ...(cityId ? { city_id: cityId, city_name: cityName } : {}),
  };

  // Atualiza o ESP; se o ID ainda não existe, cadastra automaticamente (sem dono, nome e descrição em branco)
  const { data: dev, error: e1 } = await supabase.from('devices').update(fields).eq('id', id).select('id');
  if (e1) return NextResponse.json({ error: 'db error' }, { status: 500 });
  if (!dev?.length) {
    const { error: e3 } = await supabase.from('devices').insert({ id, name: '', description: null, ...fields });
    if (e3) return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  // Leitura só entra no histórico se o sensor está lendo
  if (sensorOk) {
    const { error: e2 } = await supabase.from('readings').insert({
      device_id: id, temperature: b.temperature, humidity: b.humidity, city_id: cityId, city_name: cityName,
      external_power: b.external_power ?? null, uptime_s: b.uptime_s ?? null,
      reset_reason: b.reset_reason ?? null, free_heap: b.free_heap ?? null,
    });
    if (e2) return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  // Eventos: mudanças de estado em relação ao envio anterior
  const events: AlertEvent[] = [];
  if (prev) {
    if (prev.external_power === true && b.external_power === false)
      events.push({ kind: 'power', recovery: false, text: 'Queda de energia: o ESP passou a funcionar na bateria' });
    if (prev.external_power === false && b.external_power === true)
      events.push({ kind: 'power', recovery: true, text: 'Energia externa restabelecida' });
    if (prev.sensor_ok !== false && b.sensor_ok === false)
      events.push({ kind: 'sensor', recovery: false, text: 'O sensor de temperatura e umidade parou de ler' });
    if (prev.sensor_ok === false && b.sensor_ok === true)
      events.push({ kind: 'sensor', recovery: true, text: 'O sensor voltou a ler normalmente' });
    if (prev.uptime_s != null && b.uptime_s !== undefined && b.uptime_s < prev.uptime_s && ABNORMAL_RESET.test(b.reset_reason ?? ''))
      events.push({ kind: 'restart', recovery: false, text: `Reinício inesperado (${b.reset_reason})` });
  }

  // Alertas push: roda depois de responder ao ESP, sem atrasá-lo
  after(() => checkAlerts(id, prev?.name ?? '', {
    temperature: b.temperature, humidity: b.humidity, battery: fields.battery, battery_active: fields.battery_active,
    external_power: fields.external_power, sensor_ok: b.sensor_ok ?? null,
  }, events).catch(e => console.error('alerts', e)));

  if (cityId)
    await supabase.from('device_cities').upsert(
      { device_id: id, city_id: cityId, city_name: cityName, last_seen: now },
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
