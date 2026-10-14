'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import TopBar from '@/components/TopBar';
import PublicBar from '@/components/PublicBar';
import Battery from '@/components/Battery';
import IpLink from '@/components/IpLink';
import { Device, comfortLabel, dewPoint, formatUptime, heatIndex, isOnline, resetInfo, timeAgo, wifiPct } from '@/lib/format';

type Reading = { created_at: string; temperature: number; humidity: number };
type City = { city_id: number; city_name: string | null };
type Weather = {
  name: string; description: string; icon: string; temp: number; feels_like: number;
  humidity: number; pressure: number; wind_kmh: number | null;
  sunrise: number; sunset: number; dt: number; timezone: number;
};
type Day = { date: string; min: number; max: number; pop: number; icon: string; description: string };

const PERIODS = [{ h: 24, l: '24 horas' }, { h: 168, l: '7 dias' }, { h: 720, l: '30 dias' }];
const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hm = (sec: number, tz: number) => new Date((sec + tz) * 1000).toISOString().slice(11, 16); // hora local da cidade
const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const dec = (n: number) => n.toFixed(1).replace('.', ',');

// Períodos longos: médias por hora deixam o gráfico leve (7 dias = 168 pontos, 30 dias = 720)
function hourly(rows: Reading[]): Reading[] {
  const m = new Map<string, { t: number; h: number; n: number }>();
  for (const r of rows) {
    const k = r.created_at.slice(0, 13);
    const a = m.get(k) ?? { t: 0, h: 0, n: 0 };
    a.t += r.temperature; a.h += r.humidity; a.n++; m.set(k, a);
  }
  return [...m.entries()].map(([k, a]) => ({ created_at: `${k}:00:00Z`, temperature: a.t / a.n, humidity: a.h / a.n }));
}

function stats(rows: Reading[], key: 'temperature' | 'humidity') {
  if (!rows.length) return null;
  let min = rows[0], max = rows[0], sum = 0;
  for (const r of rows) { if (r[key] < min[key]) min = r; if (r[key] > max[key]) max = r; sum += r[key]; }
  return { min: min[key], minAt: min.created_at, max: max[key], maxAt: max.created_at, avg: sum / rows.length };
}

function exportCsv(rows: Reading[], name: string) {
  const p = (n: number) => String(n).padStart(2, '0');
  const loc = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const lines = rows.map(r => `${loc(r.created_at)};${String(r.temperature).replace('.', ',')};${String(r.humidity).replace('.', ',')}`);
  const blob = new Blob(['\ufeff' + ['data_hora;temperatura_c;umidade_pct', ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export default function Dashboard({ mode }: { mode: 'private' | 'public' }) {
  const router = useRouter();
  const pub = mode === 'public';
  const base = pub ? '/api/public' : '/api';

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [sel, setSel] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<number | null>(null);
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<Reading[]>([]);
  const [wx, setWx] = useState<{ data?: Weather; error?: string } | null>(null);
  const [fx, setFx] = useState<{ data?: Day[]; error?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadDevices = useCallback(async () => {
    const r = await fetch(`${base}/devices`);
    if (r.status === 401) { router.push('/login'); return; }
    const d: Device[] = await r.json();
    if (!Array.isArray(d)) return;
    setDevices(d);
    setSel(s => {
      if (d.some(x => x.id === s)) return s;
      let saved: string | null = null; // primeira carga: usa o último ESP escolhido neste navegador
      try { saved = localStorage.getItem('lastDevice'); } catch { /* sem armazenamento */ }
      return d.find(x => x.id === saved)?.id ?? d[0]?.id ?? '';
    });
  }, [router, base]);

  const selectCity = (id: number) => {
    setCity(id);
    try { localStorage.setItem(`lastCity:${sel}`, String(id)); } catch { /* sem armazenamento */ }
  };
  const selectDevice = (id: string) => {
    setSel(id);
    try { localStorage.setItem('lastDevice', id); } catch { /* sem armazenamento */ }
  };

  useEffect(() => {
    if (pub) return;
    fetch('/api/me').then(r => (r.ok ? r.json() : null)).then(m => setIsAdmin(m?.role === 'admin'));
  }, [pub]);

  useEffect(() => { loadDevices(); const t = setInterval(loadDevices, 60000); return () => clearInterval(t); }, [loadDevices]);

  // Cidades que o ESP selecionado já enviou
  useEffect(() => {
    if (!sel) return;
    setCities([]); setCity(null);
    fetch(`${base}/cities?device=${encodeURIComponent(sel)}`).then(r => r.json()).then((c: City[]) => {
      if (!Array.isArray(c)) return;
      setCities(c);
      let saved: number | null = null; // última cidade escolhida para este ESP neste navegador
      try { saved = Number(localStorage.getItem(`lastCity:${sel}`)) || null; } catch { /* sem armazenamento */ }
      const last = devices?.find(d => d.id === sel)?.city_id;
      setCity(c.find(x => x.city_id === saved)?.city_id ?? c.find(x => x.city_id === last)?.city_id ?? c[0]?.city_id ?? null);
    });
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sel) return;
    const q = `device=${encodeURIComponent(sel)}&hours=${hours}${city ? `&city=${city}` : ''}`;
    fetch(`${base}/readings?${q}`).then(r => r.json()).then(r => setData(Array.isArray(r) ? r : []));
  }, [sel, hours, city, devices, base]);

  // Tempo atual e previsão da cidade (OpenWeatherMap)
  useEffect(() => {
    if (city === null || !sel) { setWx(null); setFx(null); return; }
    let alive = true;
    const q = `city=${city}&device=${encodeURIComponent(sel)}`;
    const get = (path: string, ok: (x: never) => void, fail: (e: string) => void) =>
      fetch(`${base}/${path}?${q}`).then(async r => { const j = await r.json(); if (!alive) return; if (r.ok) ok(j as never); else fail(j.error); });
    const loadWx = () => get('weather', j => setWx({ data: j as Weather }), e => setWx({ error: e }));
    const loadFx = () => get('forecast', j => setFx({ data: j as Day[] }), e => setFx({ error: e }));
    loadWx(); loadFx();
    const t1 = setInterval(loadWx, 600000), t2 = setInterval(loadFx, 1800000);
    return () => { alive = false; clearInterval(t1); clearInterval(t2); };
  }, [city, sel, base]);

  const dev = devices?.find(d => d.id === sel);
  const chartRows = hours > 24 ? hourly(data) : data;
  const chart = chartRows.map(p => ({ t: fmt(p.created_at), temperature: p.temperature, humidity: p.humidity }));
  const w = wx?.data;
  const cityName = cities.find(c => c.city_id === city)?.city_name || w?.name || (city ? `Cidade ${city}` : '');
  const st = stats(data, 'temperature'), sh = stats(data, 'humidity');

  const t = dev?.last_temperature, h = dev?.last_humidity;
  const hasBoth = t != null && h != null;
  const feel = hasBoth ? heatIndex(t, h) : null;
  const dp = hasBoth ? dewPoint(t, h) : null;

  return (
    <main>
      {pub ? <PublicBar /> : <TopBar />}
      {devices === null && <p className="muted">Carregando…</p>}
      {devices?.length === 0 && (
        pub
          ? <p className="panel">Nenhuma estação pública no momento. Se você tem acesso, <Link href="/login"><u>entre</u></Link> para ver os seus dispositivos.</p>
          : <p className="panel">Nenhum ESP disponível para você. Peça a um administrador para liberar um dispositivo em <b>Usuários</b>.
              Se você é admin, o ESP aparece em <Link href="/devices"><u>Dispositivos</u></Link> assim que enviar a primeira leitura.</p>
      )}
      {dev && (
        <>
          <div className="picker">
            <select value={sel} onChange={e => selectDevice(e.target.value)} aria-label="Dispositivo">
              {devices!.map(d => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
            </select>
            {cities.length > 0 && (
              <select value={city ?? ''} onChange={e => selectCity(Number(e.target.value))} aria-label="Cidade">
                {cities.map(c => <option key={c.city_id} value={c.city_id}>{c.city_name || `Cidade ${c.city_id}`}</option>)}
              </select>
            )}
            <span className="muted">{dev.description}</span>
            <span className="small"><span className={`dot ${isOnline(dev.last_seen, dev.send_interval_s) ? 'on' : ''}`} />
              {isOnline(dev.last_seen, dev.send_interval_s) ? 'Online' : 'Offline'}, visto {timeAgo(dev.last_seen)}</span>
          </div>

          {w ? (
            <section className={`hero ${w.icon.endsWith('n') ? 'night' : ''}`}>
              <div>
                <div className="eyebrow">Tempo agora</div>
                <div className="hero-city">{cityName}</div>
                <div className="hero-temp">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://openweathermap.org/img/wn/${w.icon}@2x.png`} alt="" />
                  {Math.round(w.temp)}<small>°C</small>
                </div>
                <div className="hero-desc">{w.description}, sensação de {Math.round(w.feels_like)}°</div>
              </div>
              <div className="hero-stats">
                <div><span>Umidade</span><b>{w.humidity}%</b></div>
                <div><span>Vento</span><b>{w.wind_kmh ?? '--'} km/h</b></div>
                <div><span>Pressão</span><b>{w.pressure} hPa</b></div>
                <div><span>Sol</span><b>{hm(w.sunrise, w.timezone)} / {hm(w.sunset, w.timezone)}</b></div>
              </div>
              <div className="hero-foot">Atualizado às {hm(w.dt, w.timezone)} (hora local). Fonte: OpenWeatherMap.</div>
            </section>
          ) : (
            <section className="panel" style={{ marginTop: 18 }}>
              <div className="eyebrow muted">Tempo na cidade</div>
              {city === null && <p className="muted" style={{ margin: '6px 0 0' }}>Este ESP ainda não enviou o código da cidade (city_id).</p>}
              {city !== null && !wx && <p className="muted" style={{ margin: '6px 0 0' }}>Consultando a OpenWeatherMap…</p>}
              {wx?.error === 'no_key' && (pub
                ? <p className="muted" style={{ margin: '6px 0 0' }}>O tempo da cidade não está disponível no momento.</p>
                : <p style={{ margin: '6px 0 0' }}>Cadastre sua chave da OpenWeatherMap em <Link href="/account"><u>Minha conta</u></Link> para ver o tempo da cidade.</p>)}
              {wx?.error === 'invalid_key' && (pub
                ? <p className="muted" style={{ margin: '6px 0 0' }}>O tempo da cidade não está disponível no momento.</p>
                : <p className="error">A OpenWeatherMap recusou a chave. Confira em <Link href="/account"><u>Minha conta</u></Link>; chaves novas podem levar um tempo para ativar.</p>)}
              {wx?.error === 'owm_error' && <p className="error">Não foi possível consultar a OpenWeatherMap agora.</p>}
            </section>
          )}

          {fx?.data && fx.data.length > 0 && (
            <>
              <h2>Próximos dias{city ? ` em ${cityName}` : ''}</h2>
              <section className="forecast">
                {fx.data.map(d => (
                  <div className="tile fc" key={d.date}>
                    <div className="dow">{dayLabel(d.date)}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`} alt="" />
                    <div className="temps"><span className="max">{Math.round(d.max)}°</span> <span className="min">{Math.round(d.min)}°</span></div>
                    <div className="desc">{d.description}</div>
                    <div className="rain">Chuva {d.pop}%</div>
                  </div>
                ))}
              </section>
            </>
          )}

          <h2>Sensor do ESP</h2>
          {!pub && dev.sensor_ok === false && (
            <p className="panel error" role="alert" style={{ margin: '0 0 12px' }}>
              O sensor de temperatura e umidade parou de ler. Os valores abaixo são da última leitura boa e o histórico não está recebendo dados novos.
            </p>
          )}
          <section className="tiles">
            <div className="tile" style={{ ['--tc' as string]: 'var(--temp)' }}>
              <div className="label">Temperatura</div>
              <div className="value" style={{ color: 'var(--temp)' }}>
                {t != null ? <>{t.toFixed(1)}<small> °C</small></> : '--'}
              </div>
            </div>
            <div className="tile" style={{ ['--tc' as string]: 'var(--hum)' }}>
              <div className="label">Umidade</div>
              <div className="value" style={{ color: 'var(--hum)' }}>
                {h != null ? <>{h.toFixed(1)}<small> %</small></> : '--'}
              </div>
            </div>
            <div className="tile">
              <div className="label">Sensação térmica</div>
              <div className="value">{feel !== null ? <>{feel.toFixed(1)}<small> °C</small></> : '--'}</div>
              <div className="sub">Índice de calor</div>
            </div>
            <div className="tile">
              <div className="label">Ponto de orvalho</div>
              <div className="value">{dp !== null ? <>{dp.toFixed(1)}<small> °C</small></> : '--'}</div>
              <div className="sub">{dp !== null ? comfortLabel(dp) : 'Sem dados'}</div>
            </div>
            {!pub && (
              <>
                <div className="tile">
                  <div className="label">Sinal Wi-Fi</div>
                  <div className="value">{dev.rssi !== null ? <>{wifiPct(dev.rssi)}<small> %</small></> : '--'}</div>
                  <div className="sub">{dev.rssi !== null ? `${dev.rssi} dBm` : 'Sem dados'}</div>
                </div>
                <div className="tile" style={{ ['--tc' as string]: 'var(--ok)' }}>
                  <div className="label">Bateria</div>
                  <Battery device={dev} />
                </div>
              </>
            )}
          </section>

          <h2>Histórico{city ? ` em ${cityName}` : ''}</h2>
          <section className="panel">
            <div className="toolbar">
              <div className="seg" role="group" aria-label="Período">
                {PERIODS.map(p => (
                  <button key={p.h} className={hours === p.h ? 'on' : ''} onClick={() => setHours(p.h)}>{p.l}</button>
                ))}
              </div>
              {!pub && data.length > 0 && (
                <button className="link-btn" onClick={() => exportCsv(data, `leituras-${sel}-${hours}h.csv`)}>Exportar CSV</button>
              )}
            </div>
            <div className="chart">
              {chart.length === 0 ? <p className="muted">Ainda não há leituras neste período.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" interval="preserveStartEnd" minTickGap={48} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="t" unit="°" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                    <YAxis yAxisId="h" orientation="right" unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)' }} />
                    <Legend />
                    <Line yAxisId="t" dataKey="temperature" name="Temperatura (°C)" stroke="var(--temp)" dot={false} strokeWidth={2.2} />
                    <Line yAxisId="h" dataKey="humidity" name="Umidade (%)" stroke="var(--hum)" dot={false} strokeWidth={2.2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            {hours > 24 && chart.length > 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>Gráfico com médias por hora.</p>}
            {st && sh && (
              <div className="stats">
                <div className="stat">
                  <div className="label">Temperatura no período</div>
                  <dl>
                    <div><dt>Mínima</dt><dd>{dec(st.min)}°<small>{fmt(st.minAt)}</small></dd></div>
                    <div><dt>Máxima</dt><dd>{dec(st.max)}°<small>{fmt(st.maxAt)}</small></dd></div>
                    <div><dt>Média</dt><dd>{dec(st.avg)}°</dd></div>
                  </dl>
                </div>
                <div className="stat">
                  <div className="label">Umidade no período</div>
                  <dl>
                    <div><dt>Mínima</dt><dd>{dec(sh.min)}%<small>{fmt(sh.minAt)}</small></dd></div>
                    <div><dt>Máxima</dt><dd>{dec(sh.max)}%<small>{fmt(sh.maxAt)}</small></dd></div>
                    <div><dt>Média</dt><dd>{dec(sh.avg)}%</dd></div>
                  </dl>
                </div>
              </div>
            )}
          </section>

          {!pub && (
            <>
              <h2>Dispositivo</h2>
              <section className="panel">
                <dl className="info">
                  <div><dt>ID</dt><dd className="mono">{dev.id}</dd></div>
                  <div><dt>Endereço IP{isAdmin && dev.ip ? ' (abre a página do ESP)' : ''}</dt><dd className="mono"><IpLink ip={dev.ip} isAdmin={isAdmin} /></dd></div>
                  <div><dt>Firmware</dt><dd className="mono">{dev.firmware ?? '--'}</dd></div>
                  <div><dt>Cidade (código OpenWeatherMap)</dt><dd>{dev.city_name ? `${dev.city_name} (${dev.city_id})` : dev.city_id ?? '--'}</dd></div>
                  <div><dt>Última leitura</dt><dd>{dev.last_seen ? fmt(dev.last_seen) : '--'}</dd></div>
                  <div><dt>Página pública</dt><dd>{dev.is_public ? 'Visível' : 'Oculto'}</dd></div>
                  <div><dt>Alimentação</dt><dd>{dev.external_power === true ? 'Energia externa' : dev.external_power === false ? 'Bateria' : 'Sem placa UPS ou não informado'}</dd></div>
                  <div><dt>Sensor</dt><dd>{dev.sensor_ok === false ? 'Com falha' : dev.sensor_ok === true ? 'Lendo normalmente' : '--'}</dd></div>
                  <div><dt>Tempo ligado</dt><dd className="mono">{dev.uptime_s != null ? formatUptime(dev.uptime_s) : '--'}</dd></div>
                  <div><dt>Último reinício</dt><dd>{(() => { const ri = resetInfo(dev.reset_reason); return ri ? <span style={ri.abnormal ? { color: 'var(--bad)' } : undefined}>{ri.text}</span> : '--'; })()}</dd></div>
                  <div><dt>Memória livre</dt><dd className="mono">{dev.free_heap != null ? `${(dev.free_heap / 1024).toFixed(1).replace('.', ',')} kB` : '--'}</dd></div>
                  <div><dt>Intervalo de envio</dt><dd className="mono">{dev.send_interval_s ? `${Math.round(dev.send_interval_s / 60)} min` : '--'}</dd></div>
                  <div><dt>Tela do OLED</dt><dd>{dev.display_on == null ? '--' : dev.display_on ? 'Acesa' : 'Apagada'}</dd></div>
                  <div><dt>ID do chip</dt><dd className="mono">{dev.chip_id ?? '--'}</dd></div>
                </dl>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
