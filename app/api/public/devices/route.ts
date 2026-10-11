import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Sem login: só ESPs marcados como públicos, sem IP, firmware, bateria nem Wi-Fi
export async function GET() {
  const { data, error } = await supabase.from('devices')
    .select('id, name, description, city_id, city_name, last_temperature, last_humidity, last_seen')
    .eq('is_public', true).order('name');
  if (error) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(data.map(d => ({
    ...d, ip: null, rssi: null, firmware: null, battery: null, battery_voltage: null, battery_active: null,
  })));
}
