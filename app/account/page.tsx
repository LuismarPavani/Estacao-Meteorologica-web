'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppNav, { MaisNoCelular } from '@/components/AppNav';
import StatusMsg, { Status, errorText } from '@/components/StatusMsg';

type Me = { username: string; role: string; has_owm_key: boolean; owm_key_masked: string | null };

export default function Account() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [key, setKey] = useState('');
  const [pw, setPw] = useState('');
  const [keySt, setKeySt] = useState<Status>(null);
  const [pwSt, setPwSt] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/me');
    if (r.status === 401) { router.push('/login'); return; }
    const m: Me = await r.json();
    setMe(m); setKey(m.owm_key_masked ?? ''); // chave aparece mascarada: ************56f5
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function patch(body: object, set: (s: Status) => void, okText: string) {
    setBusy(true); set(null);
    try {
      const r = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { set({ ok: false, text: await errorText(r) }); return; }
      set({ ok: true, text: okText }); setPw(''); await load();
    } catch { set({ ok: false, text: 'Sem conexão. Tente de novo.' }); }
    finally { setBusy(false); }
  }

  // Só salva se o campo foi trocado por uma chave nova (a versão mascarada significa "sem alteração")
  const keyChanged = key.trim() !== '' && !key.includes('*');

  return (
    <main>
      <AppNav />
      <h1 className="page">Minha conta</h1>
      {me && (
        <section className="panel list">
          <div className="li"><span className="k">Usuário</span><span className="v">{me.username}</span></div>
          <div className="li"><span className="k">Tipo</span><span className="v">{me.role === 'admin' ? 'Admin (vê todos os ESPs)' : 'Normal (vê só os seus ESPs)'}</span></div>
        </section>
      )}

      <h2>Chave da OpenWeatherMap</h2>
      <div className="form panel">
        <p className="muted small" style={{ margin: 0 }}>
          {me?.has_owm_key ? 'Há uma chave cadastrada (só os 4 últimos caracteres aparecem). Para trocar, clique no campo e cole a nova.' : 'Nenhuma chave cadastrada.'}
        </p>
        <label>Chave (API key)
          <input className="mono" value={key} onChange={e => { setKey(e.target.value); setKeySt(null); }}
            onFocus={e => e.target.select()} autoComplete="off" spellCheck={false} />
        </label>
        <div className="actions">
          <button className="btn" disabled={!keyChanged || busy} onClick={() => patch({ owm_key: key }, setKeySt, 'Chave salva.')}>Salvar chave</button>
          {me?.has_owm_key && <button className="btn danger" disabled={busy} onClick={() => patch({ owm_key: '' }, setKeySt, 'Chave removida.')}>Remover</button>}
          <StatusMsg s={keySt} />
        </div>
      </div>

      <h2>Trocar senha</h2>
      <div className="form panel">
        <label>Nova senha<input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwSt(null); }} autoComplete="new-password" /></label>
        <div className="actions">
          <button className="btn" disabled={pw.length < 6 || busy} onClick={() => patch({ password: pw }, setPwSt, 'Senha alterada.')}>Alterar senha</button>
          <StatusMsg s={pwSt} />
        </div>
      </div>

      <p className="muted small">As notificações e os limites de alerta ficam em <Link href="/alerts"><u>Alertas</u></Link>.</p>
      <MaisNoCelular me={me} />
    </main>
  );
}
