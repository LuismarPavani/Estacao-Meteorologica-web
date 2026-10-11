'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import Battery from '@/components/Battery';
import StatusMsg, { Status, errorText } from '@/components/StatusMsg';
import IpLink from '@/components/IpLink';
import { Device, isOnline, timeAgo } from '@/lib/format';

export default function Devices() {
  const router = useRouter();
  const [list, setList] = useState<Device[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', description: '' });
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Record<string, Status>>({});

  const load = useCallback(async () => {
    const r = await fetch('/api/devices');
    if (r.status === 401) { router.push('/login'); return; }
    setList(await r.json());
  }, [router]);
  useEffect(() => {
    load();
    fetch('/api/me').then(r => (r.ok ? r.json() : null)).then(m => setIsAdmin(m?.role === 'admin'));
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const r = await fetch('/api/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ id: '', name: '', description: '' }); load();
  }
  async function save(d: Device) {
    const set = (v: Status) => setStatus(x => ({ ...x, [d.id]: v }));
    set(null);
    try {
      const r = await fetch(`/api/devices/${encodeURIComponent(d.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.name, description: d.description, ...(isAdmin ? { is_public: !!d.is_public } : {}) }),
      });
      set(r.ok ? { ok: true, text: 'Salvo.' } : { ok: false, text: await errorText(r) });
    } catch { set({ ok: false, text: 'Sem conexão. Tente de novo.' }); }
  }
  async function remove(d: Device) {
    if (!confirm(`Excluir "${d.name || d.id}" e todas as leituras dele?`)) return;
    await fetch(`/api/devices/${encodeURIComponent(d.id)}`, { method: 'DELETE' }); load();
  }
  const edit = (id: string, k: 'name' | 'description', v: string) =>
    setList(l => l.map(d => (d.id === id ? { ...d, [k]: v } : d)));

  return (
    <main>
      <TopBar />
      {isAdmin && (
        <>
          <h2>Cadastrar ESP</h2>
          <form className="add panel" onSubmit={add}>
            <label>ID do ESP<input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} placeholder="esp8266-sala" required /></label>
            <label>Nome<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Sala (opcional)" /></label>
            <label>Descrição<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Sensor perto da janela" /></label>
            <button className="btn">Cadastrar</button>
          </form>
          <p className="muted small">O ID precisa ser igual ao DEVICE_ID do firmware. ESPs que enviam leitura sozinhos também aparecem aqui. Para liberar um ESP a um usuário, use a tela Usuários.</p>
        </>
      )}
      {error && <p className="error">{error}</p>}

      <h2>ESPs</h2>
      {list.length === 0 && <p className="muted">Nenhum ESP disponível.</p>}
      {list.map(d => (
        <div className="row" key={d.id}>
          <label>Nome<input value={d.name} placeholder={d.id} onChange={e => edit(d.id, 'name', e.target.value)} /></label>
          <label>Descrição<input value={d.description ?? ''} onChange={e => edit(d.id, 'description', e.target.value)} /></label>
          <div className="actions">
            <button className="btn" onClick={() => save(d)}>Salvar</button>
            {isAdmin && <button className="btn danger" onClick={() => remove(d)}>Excluir</button>}
            <StatusMsg s={status[d.id]} />
          </div>
          <div className="meta">
            <span className="mono">ID: {d.id}</span>
            {d.ip && <span className="mono">IP: <IpLink ip={d.ip} isAdmin={isAdmin} /></span>}
            {d.city_id && <span>Cidade: {d.city_name ? `${d.city_name} (${d.city_id})` : d.city_id}</span>}
            <span><span className={`dot ${isOnline(d.last_seen) ? 'on' : ''}`} />{isOnline(d.last_seen) ? 'Online' : 'Offline'}, visto {timeAgo(d.last_seen)}</span>
            {isAdmin && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={!!d.is_public}
                  onChange={e => setList(l => l.map(x => (x.id === d.id ? { ...x, is_public: e.target.checked } : x)))} />
                Mostrar na página pública (clique em Salvar)
              </label>
            )}
            <Battery device={d} detail />
          </div>
        </div>
      ))}
    </main>
  );
}
