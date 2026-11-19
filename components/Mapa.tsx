'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type * as Leaflet from 'leaflet';
import AppNav from '@/components/AppNav';
import PublicBar from '@/components/PublicBar';
import { Device, batteryInfo, isOnline, timeAgo, wifiPct } from '@/lib/format';

// Mapa do tempo: mapa base claro ou escuro (segue o tema), os ESPs com a última leitura e uma camada
// por vez: radar de chuva (RainViewer, grátis e sem chave) ou as camadas da OpenWeatherMap (só logado,
// com a chave do usuário, buscadas pelo próprio painel em /api/mapa/...).

type Legenda = { unidade: string; cores: [number, string][] };
type Camada = { id: string; nome: string; owm?: boolean; legenda?: Legenda };
const CAMADAS: Camada[] = [
  { id: 'radar', nome: 'Radar' },
  { id: 'temp', nome: 'Temperatura', owm: true, legenda: { unidade: '°C', cores: [[-40, '#8257db'], [-20, '#208cec'], [0, '#23dddd'], [10, '#c2ff28'], [20, '#fff028'], [25, '#ffc228'], [30, '#fc8014']] } },
  { id: 'chuva', nome: 'Chuva', owm: true, legenda: { unidade: 'mm/h', cores: [[0.5, '#7878be'], [1, '#6e6ecd'], [10, '#5050e1'], [140, '#1414ff']] } },
  { id: 'nuvens', nome: 'Nuvens', owm: true, legenda: { unidade: '%', cores: [[0, 'rgba(255,255,255,0)'], [50, 'rgba(247,247,255,.6)'], [100, '#f0f0ff']] } },
  { id: 'vento', nome: 'Vento', owm: true, legenda: { unidade: 'm/s', cores: [[5, '#eecece'], [15, '#b364bc'], [25, '#3f213b'], [50, '#744cac'], [100, '#4600af']] } },
  { id: 'pressao', nome: 'Pressão', owm: true, legenda: { unidade: 'hPa', cores: [[960, '#00aaff'], [1000, '#8de7c7'], [1010, '#b0f720'], [1020, '#f0b800'], [1040, '#fb5515'], [1080, '#c60000']] } },
  { id: 'nenhuma', nome: 'Só o mapa' },
];
type Frame = { time: number; path: string };
const BRASIL: [number, number] = [-14.2, -51.9];
const dec = (n: number) => n.toFixed(1).replace('.', ',');
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const hora = (t: number) => new Date(t * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Ícones do balão do ESP (SVG em texto, porque o Leaflet monta o balão em HTML puro)
const COR = { ok: 'var(--ok)', mid: 'var(--warn)', low: 'var(--bad)', off: 'var(--muted)', none: 'var(--muted)' };
/** Sinal Wi-Fi em 4 barras: acesas conforme a porcentagem (como no OLED do ESP). */
function iconeSinal(pct: number) {
  const n = pct > 75 ? 4 : pct > 50 ? 3 : pct > 25 ? 2 : pct > 0 ? 1 : 0;
  const cor = n >= 3 ? COR.ok : n === 2 ? COR.mid : COR.low;
  const barras = [0, 1, 2, 3].map(i => {
    const h = 4 + i * 3.5;
    return `<rect x="${1 + i * 5}" y="${16 - h}" width="3.4" height="${h}" rx="1" fill="${i < n ? cor : 'currentColor'}" opacity="${i < n ? 1 : 0.25}"/>`;
  }).join('');
  return `<svg class="pop-ic" width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">${barras}</svg>`;
}
/** Bateria com o nível preenchido (verde, amarelo ou vermelho) e um raio quando está na energia externa. */
function iconeBateria(pct: number | null, tipo: keyof typeof COR, externa: boolean) {
  const cor = COR[tipo];
  const w = pct != null ? Math.max(1.5, (Math.min(pct, 100) / 100) * 17) : 0;
  const raio = externa ? `<path d="M12.5 2.2 8.6 7.6h2.9l-1.3 4.2 4-5.5h-2.9z" fill="var(--ink)" stroke="var(--panel)" stroke-width=".6"/>` : '';
  return `<svg class="pop-ic" width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">` +
    `<rect x="1" y="1" width="21" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="1.4"/>` +
    `<rect x="22.6" y="4.5" width="2.2" height="5" rx="1" fill="currentColor" opacity=".6"/>` +
    (w ? `<rect x="3" y="3" width="${w}" height="8" rx="1.2" fill="${cor}"/>` : '') + raio + `</svg>`;
}
/** Tomada: ESP com placa UPS, ligado na energia externa e sem dados de bateria. */
const iconeTomada = `<svg class="pop-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/></svg>`;
const linha = (icone: string, texto: string) => `<div class="pop-li">${icone}<span>${texto}</span></div>`;

export default function Mapa() {
  const [me, setMe] = useState<{ has_owm_key?: boolean } | null | undefined>(undefined); // undefined = carregando, null = sem login
  const [devices, setDevices] = useState<Device[]>([]);
  const [camada, setCamada] = useState('radar');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [host, setHost] = useState('');
  const [quadro, setQuadro] = useState(0);
  const [tocando, setTocando] = useState(true);
  const [erro, setErro] = useState('');
  const [erroOwm, setErroOwm] = useState('');

  const divRef = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const base = useRef<Leaflet.TileLayer | null>(null);
  const owm = useRef<Leaflet.TileLayer | null>(null);
  const radar = useRef(new Map<string, Leaflet.TileLayer>());
  const marcas = useRef<Leaflet.LayerGroup | null>(null);
  const [pronto, setPronto] = useState(false);

  const logado = !!me;
  const visiveis = CAMADAS.filter(c => !c.owm || logado);
  const atual = CAMADAS.find(c => c.id === camada)!;

  // Login (define o menu e as camadas) e os ESPs
  useEffect(() => { fetch('/api/me').then(r => (r.ok ? r.json() : null)).then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    if (me === undefined) return;
    fetch(me ? '/api/devices' : '/api/public/devices').then(r => r.json())
      .then((d: Device[]) => setDevices(Array.isArray(d) ? d : [])).catch(() => setDevices([]));
  }, [me]);

  // Cria o mapa (o Leaflet só roda no navegador, por isso é importado aqui)
  useEffect(() => {
    if (me === undefined || !divRef.current || mapa.current) return;
    let vivo = true;
    import('leaflet').then(mod => {
      if (!vivo || !divRef.current) return;
      L.current = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      mapa.current = L.current.map(divRef.current, { center: BRASIL, zoom: 4, minZoom: 2, maxZoom: 12, worldCopyJump: true });
      marcas.current = L.current.layerGroup().addTo(mapa.current);
      setPronto(true);
    });
    return () => { vivo = false; };
  }, [me]);
  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);

  // Mapa base do OpenStreetMap (grátis e sem chave). No tema escuro, o CSS inverte as cores só desta
  // camada (classe mapa-base), sem mexer nas cores do radar e das camadas do tempo.
  useEffect(() => {
    if (!pronto) return;
    base.current = L.current!.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, className: 'mapa-base',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa.current!);
    base.current.bringToBack();
    return () => { base.current?.remove(); base.current = null; };
  }, [pronto]);

  // ESPs no mapa (pelas coordenadas da cidade) e centraliza no último ESP escolhido no painel
  useEffect(() => {
    if (!pronto || !marcas.current) return;
    marcas.current.clearLayers();
    const comLugar = devices.filter(d => d.lat != null && d.lon != null);
    for (const d of comLugar) {
      const t = d.last_temperature != null ? `${dec(d.last_temperature)}°` : '--';
      const icon = L.current!.divIcon({ className: 'map-pin', html: `<span>${esc(t)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0], popupAnchor: [0, -34] });
      // Sinal e bateria só chegam logado (a lista pública não traz esses campos)
      const b = batteryInfo(d);
      const bateria = b.kind === 'none' ? null
        : b.pct === null ? b.status
        : `${b.pct}%${b.volts != null ? ` (${b.volts.toFixed(2).replace('.', ',')} V)` : ''}`;
      const energia = d.external_power === true ? 'energia externa' : d.external_power === false ? 'na bateria' : null;
      const online = isOnline(d.last_seen, d.send_interval_s);
      const pop = `<div class="pop">` +
        `<div class="pop-t">${esc(d.name || d.id)}</div>` +
        (d.city_name ? `<div class="pop-sub">${esc(d.city_name)}</div>` : '') +
        `<div class="pop-val"><span style="color:var(--temp)">${d.last_temperature != null ? dec(d.last_temperature) + ' °C' : '--'}</span>` +
        `<span style="color:var(--hum)">${d.last_humidity != null ? dec(d.last_humidity) + ' %' : '--'}</span></div>` +
        (d.rssi != null ? linha(iconeSinal(wifiPct(d.rssi)), `Wi-Fi ${wifiPct(d.rssi)}% <small>${d.rssi} dBm</small>`) : '') +
        (bateria ? linha(iconeBateria(b.pct, b.kind, d.external_power === true), `${esc(bateria)}${energia ? ` <small>${energia}</small>` : ''}`)
          : d.external_power === true ? linha(iconeTomada, 'Energia externa') : '') +
        `<div class="pop-foot"><span class="dot ${online ? 'on' : ''}"></span>${online ? 'Online' : 'Offline'}, visto ${esc(timeAgo(d.last_seen))}</div>` +
        `</div>`;
      L.current!.marker([d.lat!, d.lon!], { icon, title: d.name || d.id }).bindPopup(pop).addTo(marcas.current);
    }
    let salvo: string | null = null;
    try { salvo = localStorage.getItem('lastDevice'); } catch { /* sem armazenamento */ }
    const alvo = comLugar.find(d => d.id === salvo) ?? comLugar[0];
    if (alvo) mapa.current!.setView([alvo.lat!, alvo.lon!], 7);
  }, [pronto, devices]);

  // Quadros do radar (últimas 2 horas, de 10 em 10 min), atualizados a cada 10 min
  useEffect(() => {
    if (camada !== 'radar') return;
    const carrega = () => fetch('https://api.rainviewer.com/public/weather-maps.json').then(r => r.json())
      .then(j => { const f: Frame[] = j?.radar?.past ?? []; setHost(j.host); setFrames(f); setQuadro(f.length - 1); setErro(''); })
      .catch(() => setErro('Não foi possível carregar o radar agora.'));
    carrega();
    const t = setInterval(carrega, 600000);
    return () => clearInterval(t);
  }, [camada]);

  // Animação do radar: passa os quadros e para 1,5 s no mais recente
  useEffect(() => {
    if (camada !== 'radar' || !tocando || frames.length < 2) return;
    const t = setTimeout(() => setQuadro(q => (q + 1) % frames.length), quadro === frames.length - 1 ? 1500 : 600);
    return () => clearTimeout(t);
  }, [camada, tocando, frames, quadro]);

  // Mostra o quadro atual do radar (as camadas ficam carregadas, só a visível tem opacidade)
  useEffect(() => {
    if (!pronto) return;
    if (camada !== 'radar') { radar.current.forEach(l => l.remove()); radar.current.clear(); return; }
    const vistos = new Set(frames.map(f => f.path));
    radar.current.forEach((l, k) => { if (!vistos.has(k)) { l.remove(); radar.current.delete(k); } });
    const camadaDo = (f: Frame) => {
      let l = radar.current.get(f.path);
      if (!l) {
        l = L.current!.tileLayer(`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
          opacity: 0, maxNativeZoom: 7, maxZoom: 12, zIndex: 10,
          attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
        }).addTo(mapa.current!);
        radar.current.set(f.path, l);
      }
      return l;
    };
    const f = frames[quadro];
    if (!f) return;
    radar.current.forEach(l => l.setOpacity(0));
    camadaDo(f).setOpacity(0.75);
    const prox = frames[(quadro + 1) % frames.length];
    if (prox) camadaDo(prox);   // já carrega o próximo, para a animação não piscar
  }, [pronto, camada, frames, host, quadro]);

  // Camadas da OpenWeatherMap. Antes, pede um quadrado de teste: se falhar, mostra o motivo
  // (sem chave, chave recusada ou erro da OpenWeatherMap) em vez de deixar o mapa sem cor.
  useEffect(() => {
    setErroOwm('');
    if (!atual.owm) return;
    let vivo = true;
    fetch(`/api/mapa/${camada}/0/0/0`).then(async r => {
      if (!vivo || r.ok) return;
      const j = await r.json().catch(() => ({}));
      setErroOwm(j.error ?? 'owm_error');
    }).catch(() => vivo && setErroOwm('owm_error'));
    return () => { vivo = false; };
  }, [camada, atual.owm]);
  useEffect(() => {
    if (!pronto) return;
    owm.current?.remove(); owm.current = null;
    if (!atual.owm) return;
    owm.current = L.current!.tileLayer(`/api/mapa/${camada}/{z}/{x}/{y}`, {
      opacity: camada === 'nuvens' ? 0.9 : 0.75, maxNativeZoom: 10, maxZoom: 12, zIndex: 10,
      attribution: '<a href="https://openweathermap.org/">OpenWeatherMap</a>',
    }).addTo(mapa.current!);
  }, [pronto, camada, atual.owm]);

  const avisoOwm = atual.owm ? erroOwm : '';
  const legenda = atual.legenda;
  return (
    <main>
      {me === undefined ? null : me ? <><AppNav /><h1 className="page">Mapa</h1></> : <PublicBar />}
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="seg seg-wrap" role="group" aria-label="Camada do mapa">
          {visiveis.map(c => (
            <button key={c.id} className={camada === c.id ? 'on' : ''} onClick={() => setCamada(c.id)}>{c.nome}</button>
          ))}
        </div>
        {camada === 'radar' && frames.length > 0 && (
          <div className="radar-ctl">
            <button className="link-btn" onClick={() => setTocando(p => !p)} aria-label={tocando ? 'Pausar' : 'Animar'}>{tocando ? '❚❚ Pausar' : '▶ Animar'}</button>
            <input type="range" min={0} max={frames.length - 1} value={quadro} aria-label="Horário do radar"
              onChange={e => { setTocando(false); setQuadro(Number(e.target.value)); }} />
            <span className="small">{hora(frames[quadro]?.time ?? 0)}{quadro === frames.length - 1 ? ' (mais recente)' : ''}</span>
          </div>
        )}
      </div>
      {avisoOwm === 'no_key' && <p className="panel" style={{ margin: '0 0 12px' }}>Nenhuma chave da OpenWeatherMap cadastrada. Cadastre a sua em <Link href="/account"><u>Minha conta</u></Link> para ver esta camada.</p>}
      {avisoOwm === 'invalid_key' && <p className="panel error" style={{ margin: '0 0 12px' }}>A OpenWeatherMap recusou a chave para os mapas. Confira em <Link href="/account"><u>Minha conta</u></Link>; chaves novas podem levar algumas horas para ativar.</p>}
      {avisoOwm === 'owm_error' && <p className="panel error" style={{ margin: '0 0 12px' }}>Não foi possível buscar esta camada na OpenWeatherMap agora.</p>}
      {erro && camada === 'radar' && <p className="panel error" style={{ margin: '0 0 12px' }}>{erro}</p>}
      <div ref={divRef} className="mapa" aria-label="Mapa do tempo" />
      {legenda && (
        <div className="legenda">
          <span className="small muted">{legenda.unidade}</span>
          <div className="legenda-barra" style={{ background: `linear-gradient(90deg, ${legenda.cores.map(c => c[1]).join(', ')})` }} />
          <div className="legenda-num small muted">{legenda.cores.map(c => <span key={c[0]}>{String(c[0]).replace('.', ',')}</span>)}</div>
        </div>
      )}
      <p className="muted small" style={{ marginTop: 8 }}>
        {camada === 'radar'
          ? 'Radar de chuva das últimas 2 horas, de 10 em 10 minutos (RainViewer). Onde não há radar, o mapa fica sem cor.'
          : atual.owm ? 'Camada da OpenWeatherMap, atualizada a cada poucas horas. As cores da legenda são aproximadas.' : ''}
        {' '}Os ESPs aparecem nas coordenadas da cidade configurada{logado ? '' : ' (só os públicos)'}.
        {!logado && <> Entre para ver também temperatura, chuva, nuvens, vento e pressão.</>}
      </p>
    </main>
  );
}
