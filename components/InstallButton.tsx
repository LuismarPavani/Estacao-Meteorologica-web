'use client';
import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void> };

// Mostra "Instalar app" quando o navegador permite (Chrome e Edge). No iPhone: Compartilhar > Adicionar à Tela de Início.
export default function InstallButton() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    const done = () => setEv(null);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done); };
  }, []);
  if (!ev) return null;
  return <button className="link-btn" onClick={async () => { await ev.prompt(); setEv(null); }}>Instalar app</button>;
}
