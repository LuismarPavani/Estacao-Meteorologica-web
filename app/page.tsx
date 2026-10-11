import Dashboard from '@/components/Dashboard';

// Página inicial pública (sem login): mostra só os ESPs marcados como públicos
export default function Home() {
  return <Dashboard mode="public" />;
}
