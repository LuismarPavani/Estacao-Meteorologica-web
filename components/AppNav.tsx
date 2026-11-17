'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import InstallButton from './InstallButton';
import ThemeToggle from './ThemeToggle';

// Navegação do painel, no estilo da página de configurações do ESP:
// barra lateral no computador e no tablet, barra de abas embaixo no celular.
type Item = { href: string; label: string; curto: string; icone: string; cor: string; admin?: boolean };

const ESTACOES: Item[] = [
  { href: '/painel', label: 'Painel', curto: 'Painel', icone: '📈', cor: '#4fc3f7' },
  { href: '/devices', label: 'Dispositivos', curto: 'ESPs', icone: '📡', cor: '#ce93d8' },
  { href: '/alerts', label: 'Alertas', curto: 'Alertas', icone: '🔔', cor: '#ffb74d' },
];
const CONTA: Item[] = [
  { href: '/account', label: 'Minha conta', curto: 'Conta', icone: '👤', cor: '#66bb6a' },
  { href: '/users', label: 'Usuários', curto: 'Usuários', icone: '👥', cor: '#9fa8da', admin: true },
  { href: '/', label: 'Página pública', curto: 'Pública', icone: '🌐', cor: '#78909c' },
];
// Abas do celular: as 4 principais (Usuários, Página pública, tema e Sair ficam em Minha conta)
const ABAS = [ESTACOES[0], ESTACOES[1], ESTACOES[2], CONTA[0]];

export type Me = { username: string; role: string };

export default function AppNav() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { fetch('/api/me').then(r => (r.ok ? r.json() : null)).then(setMe); }, []);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/'); router.refresh();
  }
  const ativo = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const item = (i: Item) => (i.admin && me?.role !== 'admin') ? null : (
    <Link key={i.href} href={i.href} className={`ni${ativo(i.href) ? ' on' : ''}`} aria-current={ativo(i.href) ? 'page' : undefined}>
      <span className="ic" style={{ background: i.cor }} aria-hidden="true">{i.icone}</span>{i.label}
    </Link>
  );

  return (
    <>
      <aside className="side" aria-label="Menu">
        <div className="brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4 4 0 0 1 .5 8.5H7z" />
          </svg>
          Estação
        </div>
        {me && (
          <div className="me">
            <span className="av" aria-hidden="true">{me.username.slice(0, 1).toUpperCase()}</span>
            <span>{me.username}<small>{me.role === 'admin' ? 'admin' : 'usuário'}</small></span>
          </div>
        )}
        <div className="ncap">Estações</div>
        {ESTACOES.map(item)}
        <div className="ncap">Conta</div>
        {CONTA.map(item)}
        <div className="foot">
          <ThemeToggle variant="row" />
          <InstallButton variant="row" />
          <button className="ni" onClick={logout}><span className="ic" aria-hidden="true">⎋</span>Sair</button>
        </div>
      </aside>
      <nav className="tabs" aria-label="Menu">
        {ABAS.map(i => (
          <Link key={i.href} href={i.href} className={ativo(i.href) ? 'on' : ''} aria-current={ativo(i.href) ? 'page' : undefined}>
            <span className="e" aria-hidden="true">{i.icone}</span>{i.curto}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Ações que, no celular, ficam em Minha conta (no computador elas estão na barra lateral). */
export function MaisNoCelular({ me }: { me: Me | null }) {
  const router = useRouter();
  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/'); router.refresh();
  }
  return (
    <div className="only-mobile">
      <h2>Mais</h2>
      <section className="panel list">
        {me?.role === 'admin' && <Link className="li" href="/users"><span className="k">👥  Usuários</span><span className="v">›</span></Link>}
        <Link className="li" href="/"><span className="k">🌐  Página pública</span><span className="v">›</span></Link>
        <div className="li"><span className="k">Tema</span><ThemeToggle /></div>
        <InstallButton variant="li" />
        <button className="li" onClick={logout} style={{ color: 'var(--bad)' }}><span className="k">Sair{me ? ` (${me.username})` : ''}</span></button>
      </section>
    </div>
  );
}
