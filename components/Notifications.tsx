'use client';
import { useCallback, useEffect, useState } from 'react';
import StatusMsg, { Status, errorText } from '@/components/StatusMsg';
import { Device } from '@/lib/format';

type Rule = {
  device_id: string; enabled: boolean; temp_min: number | null; temp_max: number | null;
  hum_min: number | null; hum_max: number | null; battery_min: number | null; notify_recovery: boolean;
  notify_power: boolean; notify_sensor: boolean; notify_restart: boolean;
};
type Form = {
  enabled: boolean; temp_min: string; temp_max: string; hum_min: string; hum_max: string;
  battery_min: string; notify_recovery: boolean; notify_power: boolean; notify_sensor: boolean; notify_restart: boolean;
};
type Field = 'temp_min' | 'temp_max' | 'hum_min' | 'hum_max' | 'battery_min';

const LABEL: Record<Field, string> = {
  temp_min: 'temperatura mínima', temp_max: 'temperatura máxima', hum_min: 'umidade mínima',
  hum_max: 'umidade máxima', battery_min: 'bateria',
};
const show = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
const toForm = (r?: Rule): Form => ({
  enabled: r?.enabled ?? true, temp_min: show(r?.temp_min), temp_max: show(r?.temp_max), hum_min: show(r?.hum_min),
  hum_max: show(r?.hum_max), battery_min: show(r?.battery_min), notify_recovery: r?.notify_recovery ?? true,
  notify_power: r?.notify_power ?? true, notify_sensor: r?.notify_sensor ?? true, notify_restart: r?.notify_restart ?? true,
});
// Aceita vírgula ou ponto; vazio = sem limite; NaN = texto inválido
const parse = (v: string) => { const t = v.trim().replace(',', '.'); if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
const json = { 'Content-Type': 'application/json' };

function keyToBytes(b64: string) {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export default function Notifications() {
  const [support, setSupport] = useState<'checking' | 'ok' | 'unsupported' | 'ios'>('checking');
  const [active, setActive] = useState(false);   // este aparelho está registrado
  const [busy, setBusy] = useState(false);
  const [pushSt, setPushSt] = useState<Status>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [forms, setForms] = useState<Record<string, Form>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    const [d, r] = await Promise.all([fetch('/api/devices'), fetch('/api/alerts')]);
    if (!d.ok || !r.ok) return;
    const devs: Device[] = await d.json(), list: Rule[] = await r.json();
    const map = Object.fromEntries(list.map(x => [x.device_id, x]));
    setDevices(devs); setRules(map);
    setForms(Object.fromEntries(devs.map(x => [x.id, toForm(map[x.id])])));
  }, []);

  useEffect(() => {
    loadRules();
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!ok) { setSupport(/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'unsupported'); return; }
    setSupport('ok');
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => setActive(!!sub && Notification.permission === 'granted'));
  }, [loadRules]);

  async function enable() {
    setBusy(true); setPushSt(null);
    try {
      const cfg = await fetch('/api/push/config').then(r => r.json());
      if (!cfg.publicKey) { setPushSt({ ok: false, text: 'As notificações ainda não foram configuradas no servidor (chaves VAPID).' }); return; }
      if ((await Notification.requestPermission()) !== 'granted') {
        setPushSt({ ok: false, text: 'Permissão negada. Libere as notificações deste site nas configurações do navegador.' }); return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(cfg.publicKey) as BufferSource }));
      const r = await fetch('/api/push/subscribe', { method: 'POST', headers: json, body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }) });
      if (!r.ok) { setPushSt({ ok: false, text: 'Não foi possível registrar este aparelho.' }); return; }
      setActive(true); setPushSt({ ok: true, text: 'Notificações ativadas neste aparelho.' });
    } catch { setPushSt({ ok: false, text: 'Não foi possível ativar as notificações neste navegador.' }); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setPushSt(null);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: json, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setActive(false); setPushSt({ ok: true, text: 'Notificações desativadas neste aparelho.' });
    } finally { setBusy(false); }
  }

  async function test() {
    setPushSt(null);
    const r = await fetch('/api/push/test', { method: 'POST' });
    if (r.status === 503) setPushSt({ ok: false, text: 'As notificações ainda não foram configuradas no servidor (chaves VAPID).' });
    else setPushSt((await r.json()).sent > 0
      ? { ok: true, text: 'Teste enviado. A notificação deve chegar em instantes.' }
      : { ok: false, text: 'Nenhum aparelho registrado recebeu o teste.' });
  }

  const st = (id: string, s: Status) => setStatus(x => ({ ...x, [id]: s }));
  const edit = (id: string, patch: Partial<Form>) => { setForms(f => ({ ...f, [id]: { ...f[id], ...patch } })); st(id, null); };

  async function save(id: string) {
    const f = forms[id];
    const vals: Record<Field, number | null> = {
      temp_min: parse(f.temp_min), temp_max: parse(f.temp_max), hum_min: parse(f.hum_min),
      hum_max: parse(f.hum_max), battery_min: parse(f.battery_min),
    };
    const bad = (Object.keys(vals) as Field[]).find(k => vals[k] !== null && Number.isNaN(vals[k]));
    if (bad) { st(id, { ok: false, text: `Valor inválido em ${LABEL[bad]}. Use só números.` }); return; }

    setSaving(id); st(id, null);
    try {
      const r = await fetch(`/api/alerts/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: json, body: JSON.stringify({
          ...vals, enabled: f.enabled, notify_recovery: f.notify_recovery,
          notify_power: f.notify_power, notify_sensor: f.notify_sensor, notify_restart: f.notify_restart,
        }),
      });
      if (!r.ok) { st(id, { ok: false, text: await errorText(r) }); return; }
      const { rule } = (await r.json()) as { rule: Rule };
      // Atualiza só este ESP, sem apagar o que você está digitando nos outros
      setRules(x => ({ ...x, [id]: rule })); setForms(x => ({ ...x, [id]: toForm(rule) }));
      const none = Object.values(vals).every(v => v === null);
      st(id, { ok: true, text: none ? 'Salvo, mas sem nenhum limite definido: nada será monitorado.' : 'Alerta salvo.' });
    } catch { st(id, { ok: false, text: 'Sem conexão. Tente de novo.' }); }
    finally { setSaving(null); }
  }

  async function remove(id: string) {
    setSaving(id); st(id, null);
    try {
      const r = await fetch(`/api/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) { st(id, { ok: false, text: await errorText(r) }); return; }
      setRules(x => { const n = { ...x }; delete n[id]; return n; });
      setForms(x => ({ ...x, [id]: toForm() }));
      st(id, { ok: true, text: 'Alerta removido.' });
    } catch { st(id, { ok: false, text: 'Sem conexão. Tente de novo.' }); }
    finally { setSaving(null); }
  }

  const num = (id: string, f: Field, label: string, f0: Form) => (
    <label>{label}
      <input type="text" inputMode="decimal" autoComplete="off" value={f0[f]} placeholder="sem limite"
        onChange={e => edit(id, { [f]: e.target.value } as Partial<Form>)} />
    </label>
  );

  return (
    <>
      <h2>Notificações</h2>
      <div className="form" style={{ maxWidth: 560 }}>
        {support === 'unsupported' && <p className="muted small" style={{ margin: 0 }}>Este navegador não suporta notificações push.</p>}
        {support === 'ios' && <p className="muted small" style={{ margin: 0 }}>No iPhone, instale o app antes: toque em Compartilhar e em <b>Adicionar à Tela de Início</b>, abra o app instalado e volte aqui. É necessário iOS 16.4 ou mais novo.</p>}
        {support === 'ok' && (
          <>
            <p className="muted small" style={{ margin: 0 }}>
              {active ? 'Este aparelho está recebendo os alertas abaixo.' : 'Ative para receber os alertas neste aparelho (cada celular ou navegador precisa ativar uma vez).'}
            </p>
            <div className="actions">
              {!active
                ? <button className="btn" disabled={busy} onClick={enable}>Ativar notificações neste aparelho</button>
                : <>
                    <button className="btn" onClick={test}>Enviar teste</button>
                    <button className="btn danger" disabled={busy} onClick={disable}>Desativar</button>
                  </>}
              <StatusMsg s={pushSt} />
            </div>
          </>
        )}
      </div>

      <h2>Alertas por ESP</h2>
      <p className="muted small" style={{ marginTop: 0 }}>Cada ESP tem os seus limites. Deixe em branco o que não quiser monitorar; pode usar vírgula ou ponto.</p>
      {devices.length === 0 && <p className="muted">Nenhum ESP disponível para configurar.</p>}
      {devices.map(d => {
        const f = forms[d.id] ?? toForm();
        return (
          <div className="row wide" key={d.id}>
            <div><b>{d.name || d.id}</b><div className="muted small">{rules[d.id] ? (rules[d.id].enabled ? 'Alerta ativo' : 'Alerta pausado') : 'Sem alerta'}</div></div>
            {num(d.id, 'temp_min', 'Temperatura mínima (°C)', f)}
            {num(d.id, 'temp_max', 'Temperatura máxima (°C)', f)}
            {num(d.id, 'hum_min', 'Umidade mínima (%)', f)}
            {num(d.id, 'hum_max', 'Umidade máxima (%)', f)}
            {num(d.id, 'battery_min', 'Avisar bateria em (%)', f)}
            <div className="meta" style={{ display: 'flex' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={f.enabled} onChange={e => edit(d.id, { enabled: e.target.checked })} /> Alertas ligados
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={f.notify_recovery} onChange={e => edit(d.id, { notify_recovery: e.target.checked })} /> Avisar quando voltar ao normal
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={f.notify_power} onChange={e => edit(d.id, { notify_power: e.target.checked })} /> Queda de energia
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={f.notify_sensor} onChange={e => edit(d.id, { notify_sensor: e.target.checked })} /> Falha do sensor
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={f.notify_restart} onChange={e => edit(d.id, { notify_restart: e.target.checked })} /> Reinício inesperado
              </label>
            </div>
            <div className="actions" style={{ gridColumn: '1 / -1' }}>
              <button className="btn" disabled={saving === d.id} onClick={() => save(d.id)}>{saving === d.id ? 'Salvando…' : 'Salvar'}</button>
              {rules[d.id] && <button className="btn danger" disabled={saving === d.id} onClick={() => remove(d.id)}>Remover</button>}
              <StatusMsg s={status[d.id]} />
            </div>
          </div>
        );
      })}
    </>
  );
}
