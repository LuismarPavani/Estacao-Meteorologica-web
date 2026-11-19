import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CAMPOS = 'id, name, description, city_id, city_name, last_temperature, last_humidity, last_seen';

// Sem login: só ESPs marcados como públicos, sem IP, firmware, bateria nem Wi-Fi.
// As coordenadas são as da cidade (não as da casa) e servem para a Lua e o mapa.
export async function GET() {
  const pub = (campos: string) => supabase.from('devices').select(campos).eq('is_public', true).order('name');
  let { data, error } = await pub(`${CAMPOS}, lat, lon`);
  if (error) ({ data, error } = await pub(CAMPOS));   // banco sem o migration-v5.sql: segue sem coordenadas
  if (error || !data) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json((data as unknown as Record<string, unknown>[]).map(d => ({
    ...d, ip: null, rssi: null, firmware: null, battery: null, battery_voltage: null, battery_active: null,
  })));
}
