import AppNav from '@/components/AppNav';
import Notifications from '@/components/Notifications';

// Alertas: ativar as notificações neste aparelho e os limites de cada ESP
export default function Alerts() {
  return (
    <main>
      <AppNav />
      <h1 className="page">Alertas</h1>
      <Notifications />
    </main>
  );
}
