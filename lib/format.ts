export type Device = {
  id: string; name: string; description: string | null;
  ip: string | null; rssi: number | null; firmware: string | null;
  battery: number | null; battery_voltage: number | null; battery_active: boolean | null;
  last_temperature: number | null; last_humidity: number | null; last_seen: string | null;
  city_id: number | null; city_name: string | null; is_public?: boolean;
  external_power?: boolean | null; sensor_ok?: boolean | null; uptime_s?: number | null; reset_reason?: string | null;
  free_heap?: number | null; chip_id?: string | null; send_interval_s?: number | null; display_on?: boolean | null;
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

// Offline = sem leitura há mais de 2,5 vezes o intervalo de envio informado pelo ESP (padrão: 15 min)
export const isOnline = (iso: string | null, intervalS?: number | null) =>
  !!iso && Date.now() - new Date(iso).getTime() < 2.5 * (intervalS && intervalS > 0 ? intervalS : 900) * 1000;

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

// Tempo ligado, por exemplo "2 d 3 h" ou "45 min"
export function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

// Motivo do último reinício do ESP8266, em português. "abnormal" = travamento ou erro no firmware.
export function resetInfo(reason?: string | null) {
  if (!reason) return null;
  const r = reason.toLowerCase();
  if (r.includes('exception')) return { text: 'Exceção (erro no firmware)', abnormal: true };
  if (r.includes('watchdog')) return { text: `${r.includes('hardware') ? 'Watchdog de hardware' : 'Watchdog de software'} (travamento)`, abnormal: true };
  if (r.includes('power')) return { text: 'Ligado na energia', abnormal: false };
  if (r.includes('software') || r.includes('system restart')) return { text: 'Reinício por software (normal após reset pelos botões ou pela página)', abnormal: false };
  if (r.includes('external')) return { text: 'Reset externo (botão RST)', abnormal: false };
  if (r.includes('deep')) return { text: 'Saiu do deep sleep', abnormal: false };
  return { text: reason, abnormal: false };
}
