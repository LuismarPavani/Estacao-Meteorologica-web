'use client';
import { useEffect, useState } from 'react';
import { calculaLua, caminhoLua, solPorCoordenadas } from '@/lib/lua';

// Cartão "Sol e Lua": fase (com o desenho da parte iluminada), iluminação, nascer e pôr da Lua e do Sol
// e as datas da próxima Lua cheia e nova. Tudo calculado no navegador, como na tela do ESP.
type Props = {
  lat?: number | null; lon?: number | null;
  // Nascer e pôr do Sol da OpenWeatherMap (segundos UNIX) e o fuso da cidade (segundos); sem eles, calcula aqui
  sunrise?: number; sunset?: number; timezone?: number;
};

export default function SolLua({ lat, lon, sunrise, sunset, timezone }: Props) {
  const [agora, setAgora] = useState<Date | null>(null);
  // Só no navegador (evita diferença entre o HTML do servidor e o do cliente) e atualiza a cada 10 min
  useEffect(() => { setAgora(new Date()); const t = setInterval(() => setAgora(new Date()), 600000); return () => clearInterval(t); }, []);
  if (!agora) return null;

  const temLugar = lat != null && lon != null;
  const lua = calculaLua(agora, lat, lon);
  const sul = temLugar && lat! < 0;
  const tz = timezone ?? -agora.getTimezoneOffset() * 60;   // fuso da cidade; sem ele, o do aparelho
  const hm = (d: Date | null) => (d ? new Date(d.getTime() + tz * 1000).toISOString().slice(11, 16) : '--');
  const dia = (d: Date) => new Date(d.getTime() + tz * 1000)
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const sol = sunrise && sunset
    ? { nasce: new Date(sunrise * 1000), poe: new Date(sunset * 1000) }
    : temLugar ? solPorCoordenadas(agora, lat!, lon!) : null;
  const luaHoras = lua.sempreAcima ? 'acima do horizonte o dia todo'
    : lua.sempreAbaixo ? 'abaixo do horizonte o dia todo'
    : `${hm(lua.nasce)} / ${hm(lua.poe)}`;
  const cheiaAntes = lua.proximaCheia < lua.proximaNova;

  return (
    <section className="panel lua-card">
      <svg className="lua-svg" viewBox="0 0 100 100" role="img" aria-label={`${lua.nome}, ${lua.iluminacao}% iluminada`}>
        <circle cx="50" cy="50" r="44" className="lua-sombra" />
        <path d={caminhoLua(50, 50, 44, lua.iluminacao, lua.crescendo, sul)} className="lua-luz" />
        <circle cx="50" cy="50" r="44" className="lua-borda" />
      </svg>
      <div className="lua-info">
        <div className="eyebrow muted">Lua agora</div>
        <div className="lua-nome">{lua.nome}</div>
        <div className="muted">{lua.iluminacao}% iluminada, {lua.crescendo ? 'crescendo' : 'diminuindo'}</div>
        <dl className="lua-dl">
          <div><dt>Lua (nasce / põe)</dt><dd>{temLugar ? luaHoras : '--'}</dd></div>
          <div><dt>Sol (nasce / põe)</dt><dd>{sol ? `${hm(sol.nasce)} / ${hm(sol.poe)}` : '--'}</dd></div>
          {cheiaAntes ? (
            <>
              <div><dt>Próxima cheia</dt><dd>{dia(lua.proximaCheia)}</dd></div>
              <div><dt>Próxima nova</dt><dd>{dia(lua.proximaNova)}</dd></div>
            </>
          ) : (
            <>
              <div><dt>Próxima nova</dt><dd>{dia(lua.proximaNova)}</dd></div>
              <div><dt>Próxima cheia</dt><dd>{dia(lua.proximaCheia)}</dd></div>
            </>
          )}
        </dl>
        {!temLugar && <p className="muted small" style={{ margin: '6px 0 0' }}>Sem as coordenadas da cidade, o nascer e o pôr não são calculados.</p>}
      </div>
    </section>
  );
}
