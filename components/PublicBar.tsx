'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import InstallButton from './InstallButton';
import ThemeToggle from './ThemeToggle';

// Topo da página pública: botão Entrar no canto (ou Painel, se já estiver logado)
export default function PublicBar() {
  const [logged, setLogged] = useState(false);
  useEffect(() => { fetch('/api/me').then(r => setLogged(r.ok)); }, []);
  return (
    <header className="top">
      <div className="brand">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4 4 0 0 1 .5 8.5H7z" />
        </svg>
        Estação meteorológica
      </div>
      <nav>
        <InstallButton />
        <ThemeToggle />
        <Link className="btn-link" href={logged ? '/painel' : '/login'}>{logged ? 'Painel' : 'Entrar'}</Link>
      </nav>
    </header>
  );
}
