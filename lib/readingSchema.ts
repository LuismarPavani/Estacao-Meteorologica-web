import { z } from 'zod';

// Corpo do POST /api/readings. Os campos novos são opcionais para um ESP com firmware antigo continuar sendo aceito.
// Campos desconhecidos são ignorados (protege contra firmwares futuros).
const cityId = z.preprocess(
  v => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
  z.number().int().positive().nullable().optional());

export const readingSchema = z.object({
  device_id: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/, 'até 32 caracteres: letras, números, - _ .'),
  temperature: z.number().min(-40).max(85),
  humidity: z.number().min(0).max(100),
  ip: z.string().max(45).optional(),
  rssi: z.number().int().optional(),
  city_id: cityId,
  city_name: z.string().max(80).optional(),
  firmware: z.string().max(32).optional(),
  battery_active: z.boolean().optional(),
  battery: z.number().int().min(0).max(100).optional(),
  battery_voltage: z.number().min(0).max(5).optional(),
  // novos
  external_power: z.boolean().nullable().optional(), // true = energia externa; false = bateria; null = ESP sem placa UPS
  sensor_ok: z.boolean().optional(),
  uptime_s: z.number().int().nonnegative().optional(),
  reset_reason: z.string().max(40).optional(),
  free_heap: z.number().int().nonnegative().optional(),
  chip_id: z.string().max(16).optional(),
  send_interval_s: z.number().int().positive().optional(),
  display_on: z.boolean().optional(),
  rssi_pct: z.number().int().min(0).max(100).optional(), // aceito, mas ignorado: o painel calcula pelo rssi
});
export type ReadingBody = z.infer<typeof readingSchema>;
