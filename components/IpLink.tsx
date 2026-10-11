// Endereço IP do ESP. Para admins vira um atalho para a página inicial do próprio ESP (http://IP/), de onde se chega às configurações.
// Só funciona com o navegador na mesma rede do ESP. Para os demais usuários, mostra apenas o IP.
const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;

export default function IpLink({ ip, isAdmin }: { ip: string | null; isAdmin: boolean }) {
  if (!ip) return <>--</>;
  if (!isAdmin || !IPV4.test(ip)) return <>{ip}</>;
  return (
    <a className="ip-link" href={`http://${ip}/`} target="_blank" rel="noopener noreferrer"
       title="Abrir a página do ESP (o navegador precisa estar na mesma rede do ESP)">
      {ip} <span aria-hidden="true">↗</span>
    </a>
  );
}
