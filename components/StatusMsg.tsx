// Mensagem de resultado ao lado do botão que foi clicado (sucesso ou erro)
export type Status = { ok: boolean; text: string } | null | undefined;

export default function StatusMsg({ s }: { s: Status }) {
  if (!s) return null;
  return <span role="status" aria-live="polite" className={`st ${s.ok ? 'ok' : 'err'}`}>{s.ok ? '✓ ' : ''}{s.text}</span>;
}

// Traduz a resposta de erro da API em um texto claro
export async function errorText(r: Response) {
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (r.status === 403) return 'Você não tem permissão para isso.';
  return (j as { error?: string }).error ?? 'Não foi possível salvar.';
}
