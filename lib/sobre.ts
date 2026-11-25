// Links do projeto e leitura dos READMEs do GitHub para a página Sobre.
// Os READMEs vêm do GitHub (sempre a versão publicada) e ficam 1 h em cache no servidor.

export const GITHUB_PERFIL = 'https://github.com/LuismarPavani';
export const REPO_FIRMWARE = 'LuismarPavani/Estacao-Meteorologica';
export const REPO_PAINEL = 'LuismarPavani/Estacao-Meteorologica-web';
export const PAINEL_URL = 'https://weatherstation-web.vercel.app/';
const RAMO = 'main';

export const repoUrl = (repo: string) => `https://github.com/${repo}`;

/** Lê o README.md de um repositório. Em qualquer erro (GitHub fora, repositório privado), devolve null. */
export async function lerReadme(repo: string): Promise<string | null> {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${repo}/${RAMO}/README.md`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/**
 * Endereços relativos do README (LICENSE, docs/img/...) passam a apontar para o GitHub;
 * âncoras (#secao) ficam na página. Protocolos estranhos (javascript: etc.) são descartados.
 */
export function urlDoReadme(repo: string, url: string, imagem: boolean): string {
  if (url.startsWith('#')) return url;
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';
  const caminho = url.replace(/^\.?\//, '');
  return imagem
    ? `https://raw.githubusercontent.com/${repo}/${RAMO}/${caminho}`
    : `https://github.com/${repo}/blob/${RAMO}/${caminho}`;
}
