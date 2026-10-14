import { sendToUser } from './push';
import { supabase } from './supabase';

type Reading = {
  temperature: number; humidity: number; battery: number | null; battery_active: boolean | null;
  external_power: boolean | null; sensor_ok: boolean | null;
};
// Evento = mudança de estado informada pelo ESP (queda de energia, sensor, reinício)
export type AlertEvent = { kind: 'power' | 'sensor' | 'restart'; recovery: boolean; text: string };
type Rule = {
  user_id: string; temp_min: number | null; temp_max: number | null; hum_min: number | null; hum_max: number | null;
  battery_min: number | null; notify_recovery: boolean;
  notify_power: boolean; notify_sensor: boolean; notify_restart: boolean;
};
type Def = {
  m: string; low: boolean; label: string; unit: string; word: string;
  limit: (x: Rule) => number | null; value: (r: Reading) => number | null;
  margin: number;       // histerese: só considera "voltou ao normal" depois dessa folga (evita avisos repetidos no limite)
  remindHours: number;  // se continuar fora do limite, repete o aviso depois desse tempo
  inclusive?: boolean;  // o próprio limite já conta como alerta (bateria)
};

const DEFS: Def[] = [
  { m: 'temp_low', low: true, label: 'Temperatura', unit: ' °C', word: 'mín.', limit: x => x.temp_min, value: r => r.temperature, margin: 0.5, remindHours: 2 },
  { m: 'temp_high', low: false, label: 'Temperatura', unit: ' °C', word: 'máx.', limit: x => x.temp_max, value: r => r.temperature, margin: 0.5, remindHours: 2 },
  { m: 'hum_low', low: true, label: 'Umidade', unit: ' %', word: 'mín.', limit: x => x.hum_min, value: r => r.humidity, margin: 2, remindHours: 2 },
  { m: 'hum_high', low: false, label: 'Umidade', unit: ' %', word: 'máx.', limit: x => x.hum_max, value: r => r.humidity, margin: 2, remindHours: 2 },
  { m: 'battery_low', low: true, label: 'Bateria', unit: ' %', word: 'aviso em', limit: x => x.battery_min,
    value: r => (r.battery_active && r.battery != null ? r.battery : null), margin: 5, remindHours: 6, inclusive: true },
];
const f1 = (n: number) => n.toFixed(1).replace('.', ',');
const fl = (n: number) => String(n).replace('.', ',');

// Chamada a cada leitura recebida: compara com as regras de cada usuário que tem acesso ao ESP
export async function checkAlerts(deviceId: string, deviceName: string, r: Reading, events: AlertEvent[] = []) {
  const { data: rules } = await supabase.from('alert_rules').select('*').eq('device_id', deviceId).eq('enabled', true);
  if (!rules?.length) return;
  const ids = rules.map(x => x.user_id);
  const [users, links, states] = await Promise.all([
    supabase.from('users').select('id, role').in('id', ids),
    supabase.from('user_devices').select('user_id').eq('device_id', deviceId).in('user_id', ids),
    supabase.from('alert_state').select('user_id, metric, active, last_sent').eq('device_id', deviceId).in('user_id', ids),
  ]);
  // Só quem ainda tem acesso ao ESP (admin ou liberado) recebe
  const allowed = new Set<string>([
    ...(users.data ?? []).filter(u => u.role === 'admin').map(u => u.id),
    ...(links.data ?? []).map(l => l.user_id),
  ]);
  const now = Date.now(), nowIso = new Date(now).toISOString();

  for (const rule of rules as Rule[]) {
    if (!allowed.has(rule.user_id)) continue;
    const lines: string[] = [];
    const upserts: { user_id: string; device_id: string; metric: string; active: boolean; last_sent: string | null }[] = [];

    for (const d of DEFS) {
      const st = states.data?.find(s => s.user_id === rule.user_id && s.metric === d.m);
      const row = (active: boolean, last: string | null) =>
        upserts.push({ user_id: rule.user_id, device_id: deviceId, metric: d.m, active, last_sent: last });
      // Sensor com defeito envia 0.0: não avalia temperatura nem umidade
      if (r.sensor_ok === false && (d.m.startsWith('temp') || d.m.startsWith('hum'))) continue;
      // Na energia externa a bateria não está descarregando: zera o alerta para avisar de novo se for desligada ainda baixa
      if (d.m === 'battery_low' && r.external_power === true) { if (st?.active) row(false, st.last_sent); continue; }
      const lim = d.limit(rule), val = d.value(r);

      if (lim == null) { if (st?.active) row(false, st.last_sent); continue; } // limite removido
      if (val == null) continue;                                               // sem dado: mantém o estado

      const breach = d.low ? (d.inclusive ? val <= lim : val < lim) : val > lim;
      const back = d.low ? val >= lim + d.margin : val <= lim - d.margin;
      const num = d.unit === ' °C' ? f1(val) : d.label === 'Umidade' ? f1(val) : String(Math.round(val));

      if (breach) {
        const due = !st?.active || now - (st.last_sent ? Date.parse(st.last_sent) : 0) >= d.remindHours * 3600_000;
        if (due) {
          lines.push(`${d.label} ${d.low ? 'baixa' : 'alta'}: ${num}${d.unit} (${d.word} ${fl(lim)}${d.unit})`);
          row(true, nowIso);
        }
      } else if (st?.active && back) {
        if (rule.notify_recovery) lines.push(`${d.label} voltou ao normal: ${num}${d.unit}`);
        row(false, st.last_sent);
      }
    }

    for (const ev of events) {
      if (ev.recovery && !rule.notify_recovery) continue;
      const wanted = ev.kind === 'power' ? rule.notify_power : ev.kind === 'sensor' ? rule.notify_sensor : rule.notify_restart;
      if (wanted) lines.push(ev.text);
    }

    if (upserts.length)
      await supabase.from('alert_state').upsert(upserts, { onConflict: 'user_id,device_id,metric' });
    if (lines.length)
      await sendToUser(rule.user_id, { title: deviceName || deviceId, body: lines.join('\n'), tag: deviceId, url: '/painel' });
  }
}
