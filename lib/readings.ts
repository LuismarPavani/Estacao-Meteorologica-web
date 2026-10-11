import { supabase } from './supabase';

// O Supabase limita 1000 linhas por consulta; pagina até acabar
export async function fetchReadings(device: string, hours: number, city: number | null) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const rows: unknown[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    let q = supabase.from('readings').select('created_at, temperature, humidity')
      .eq('device_id', device).gte('created_at', since);
    if (city) q = q.eq('city_id', city);
    const { data, error } = await q.order('created_at').range(from, from + 999);
    if (error) return null;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
