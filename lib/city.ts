import { supabase } from './supabase';

// Onde consultar o clima: pelas coordenadas (preferido) ou pelo código da cidade na OpenWeatherMap
export type Loc = { lat: number; lon: number } | { id: number };

/**
 * Código interno de uma cidade sem city_id (ESP que escolheu a cidade pela busca ou por latitude/longitude).
 * É sempre negativo, para nunca colidir com os códigos da OpenWeatherMap (sempre positivos), e usa as
 * coordenadas com 2 casas (~1 km): pequenas diferenças de arredondamento não criam uma "cidade" nova.
 * Cabe num int do Postgres: no máximo 18001 × 36001 ≈ 648 milhões.
 */
export function coordKey(lat: number, lon: number) {
  const a = Math.round((lat + 90) * 100);   // 0 a 18000
  const b = Math.round((lon + 180) * 100);  // 0 a 36000
  return -(a * 36001 + b + 1);
}

/**
 * Como consultar o clima de uma cidade de um ESP: pelas coordenadas salvas em device_cities (quando o ESP
 * as enviou) ou, para códigos positivos sem coordenadas, pelo código da OpenWeatherMap. null = sem como consultar.
 */
export async function cityLocation(device: string | null, city: number): Promise<Loc | null> {
  if (device) {
    const { data } = await supabase.from('device_cities').select('lat, lon')
      .eq('device_id', device).eq('city_id', city).maybeSingle();
    if (data?.lat != null && data?.lon != null) return { lat: data.lat, lon: data.lon };
  }
  return city > 0 ? { id: city } : null;
}

// Lê o parâmetro ?city= (código da OpenWeatherMap ou código interno negativo); null se inválido
export function parseCity(v: string | null) {
  const n = Number(v);
  return Number.isInteger(n) && n !== 0 ? n : null;
}
