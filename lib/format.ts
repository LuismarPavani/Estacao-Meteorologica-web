export type Device = {
  id: string; name: string; description: string | null;
  ip: string | null; rssi: number | null; firmware: string | null;
  battery: number | null; battery_voltage: number | null; battery_active: boolean | null;
  last_temperature: number | null; last_humidity: number | null; last_seen: string | null;
  city_id: number | null; city_name: string | null; is_public?: boolean;
};

export const wifiPct = (rssi: number) => Math.max(0, Math.min(100, 2 * (rssi + 100)));

export function timeAgo(iso: string | null) {
  if (!iso) return 'nunca';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} d`;
}

// O ESP envia a cada 15 min: sem leitura há mais de 40 min (2 envios perdidos + folga) considera offline
export const SEND_INTERVAL_MIN = 15;
export const isOnline = (iso: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() < (SEND_INTERVAL_MIN * 2 + 10) * 60000;

export function batteryInfo(d: Pick<Device, 'battery' | 'battery_voltage' | 'battery_active'>) {
  if (d.battery_active === null && d.battery === null)
    return { kind: 'none' as const, status: 'Sem dados', pct: null, volts: null };
  if (!d.battery_active)
    return { kind: 'off' as const, status: 'Bateria inativa', pct: null, volts: null };
  const pct = d.battery ?? 0;
  return {
    kind: (pct <= 15 ? 'low' : pct <= 40 ? 'mid' : 'ok') as 'low' | 'mid' | 'ok',
    status: 'Bateria ativa', pct, volts: d.battery_voltage,
  };
}

// Ponto de orvalho (fórmula de Magnus), em °C
export function dewPoint(t: number, h: number) {
  if (h <= 0) return null;
  const a = 17.62, b = 243.12, g = Math.log(h / 100) + (a * t) / (b + t);
  return (b * g) / (a - g);
}

// Sensação térmica pelo índice de calor (Rothfusz); abaixo de 26,7 °C ou 40 % de umidade vale a própria temperatura
export function heatIndex(t: number, h: number) {
  if (t < 26.7 || h < 40) return t;
  const f = (t * 9) / 5 + 32;
  const hi = -42.379 + 2.04901523 * f + 10.14333127 * h - 0.22475541 * f * h - 0.00683783 * f * f
    - 0.05481717 * h * h + 0.00122874 * f * f * h + 0.00085282 * f * h * h - 0.00000199 * f * f * h * h;
  return ((hi - 32) * 5) / 9;
}

// Conforto pelo ponto de orvalho
export function comfortLabel(dp: number) {
  if (dp < 10) return 'Ar seco';
  if (dp < 16) return 'Confortável';
  if (dp < 18) return 'Levemente úmido';
  if (dp < 21) return 'Abafado';
  if (dp < 24) return 'Muito abafado';
  return 'Opressivo';
}
