'use client';
import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void> };

// Mostra "Instalar app" quando o navegador permite (Chrome e Edge). No iPhone: Compartilhar > Adicionar à Tela de Início.
// variant: 'pill' (topo da página pública), 'row' (barra lateral) ou 'li' (linha de cartão, em Minha conta no celular).
export default function InstallButton({ variant = 'pill' }: { variant?: 'pill' | 'row' | 'li' }) {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    const done = () => setEv(null);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done); };
  }, []);
  if (!ev) return null;
  const instalar = async () => { await ev.prompt(); setEv(null); };
  if (variant === 'row') return <button className="ni" onClick={instalar}><span className="ic" aria-hidden="true">⬇</span>Instalar app</button>;
  if (variant === 'li') return <button className="li" onClick={instalar}><span className="k">Instalar app</span><span className="v">›</span></button>;
  return <button className="link-btn" onClick={instalar}>Instalar app</button>;
}
