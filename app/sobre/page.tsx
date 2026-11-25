import Link from 'next/link';
import { cookies } from 'next/headers';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import AppNav from '@/components/AppNav';
import PublicBar from '@/components/PublicBar';
import { COOKIE, verifySession } from '@/lib/auth';
import { GITHUB_PERFIL, PAINEL_URL, REPO_FIRMWARE, REPO_PAINEL, lerReadme, repoUrl, urlDoReadme } from '@/lib/sobre';
import pkg from '@/package.json';

export const metadata = { title: 'Sobre · Estação meteorológica' };

// Sobre: resumo do projeto, links do GitHub e o manual (README) do firmware ou do painel, lido do GitHub.
// Aberta a todos (como a página pública); logado, aparece com o menu do painel.
export default async function Sobre({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc } = await searchParams;
  const painel = doc === 'painel';
  const repo = painel ? REPO_PAINEL : REPO_FIRMWARE;
  const [sessao, md] = await Promise.all([
    cookies().then(c => verifySession(c.get(COOKIE)?.value)),
    lerReadme(repo),
  ]);

  return (
    <main>
      {sessao ? <AppNav /> : <PublicBar />}
      <h1 className="page">Sobre</h1>

      <section className="panel sobre-intro">
        <p>
          Estação meteorológica doméstica com <b>ESP8266</b>: display OLED, sensor de temperatura e umidade,
          clima e previsão do OpenWeatherMap, página web própria e configuração pelo navegador. Este painel
          recebe as leituras de uma ou mais estações, guarda o histórico e mostra gráficos, mapa e alertas.
        </p>
        <p className="muted small">Painel v{pkg.version} · licença MIT · baseado no exemplo WeatherStation da ThingPulse.</p>
      </section>

      <h2>Links</h2>
      <section className="panel list">
        <a className="li" href={repoUrl(REPO_FIRMWARE)} target="_blank" rel="noopener noreferrer">
          <span className="k">💾  Código do firmware (ESP8266)<small>github.com/{REPO_FIRMWARE}</small></span><span className="v">↗</span>
        </a>
        <a className="li" href={repoUrl(REPO_PAINEL)} target="_blank" rel="noopener noreferrer">
          <span className="k">🧩  Código do painel<small>github.com/{REPO_PAINEL}</small></span><span className="v">↗</span>
        </a>
        <a className="li" href={PAINEL_URL} target="_blank" rel="noopener noreferrer">
          <span className="k">📈  Painel online<small>{PAINEL_URL.replace(/^https:\/\/|\/$/g, '')}</small></span><span className="v">↗</span>
        </a>
        <a className="li" href={GITHUB_PERFIL} target="_blank" rel="noopener noreferrer">
          <span className="k">👤  Luismar Pavani<small>perfil no GitHub</small></span><span className="v">↗</span>
        </a>
      </section>

      <h2>Manual</h2>
      <div className="seg" role="group" aria-label="Manual" style={{ marginBottom: 12 }}>
        <Link href="/sobre" className={painel ? '' : 'on'} aria-current={painel ? undefined : 'page'} scroll={false}>Firmware</Link>
        <Link href="/sobre?doc=painel" className={painel ? 'on' : ''} aria-current={painel ? 'page' : undefined} scroll={false}>Painel</Link>
      </div>
      <article className="panel md">
        {md ? (
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
            skipHtml
            urlTransform={(url, key) => urlDoReadme(repo, url, key === 'src')}
            components={{
              a: ({ href, children }) =>
                href?.startsWith('#')
                  ? <a href={href}>{children}</a>
                  : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
              table: ({ children }) => <div className="md-tabela"><table>{children}</table></div>,
            }}
          >
            {md}
          </Markdown>
        ) : (
          <p className="muted">
            Não consegui ler o manual agora. Veja direto no{' '}
            <a href={`${repoUrl(repo)}#readme`} target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>
        )}
      </article>
    </main>
  );
}
