import SunCalc from 'suncalc';

// Fase, iluminação, nascer e pôr da Lua, calculados no navegador (sem gastar a cota da OpenWeatherMap).
// Os nomes são os mesmos da tela "Sol e Lua" do ESP.
export const FASES = [
  'Lua nova', 'Crescente', 'Quarto crescente', 'Crescente gibosa',
  'Lua cheia', 'Minguante gibosa', 'Quarto minguante', 'Minguante',
];

export type Lua = {
  fase: number;          // 0 = nova ... 4 = cheia ... 7
  nome: string;
  ciclo: number;         // 0 a 1 (0 e 1 = nova, 0,5 = cheia)
  iluminacao: number;    // 0 a 100 (%)
  crescendo: boolean;    // true da Lua nova até a cheia
  nasce: Date | null;
  poe: Date | null;
  sempreAcima: boolean;  // perto dos polos a Lua pode não nascer nem se pôr no dia
  sempreAbaixo: boolean;
  proximaCheia: Date;
  proximaNova: Date;
};

// Próximo instante em que o ciclo passa por 'alvo' (0 = nova, 0,5 = cheia): procura de hora em hora
// e refina por bisseção (precisão de ~1 min). O ciclo lunar tem ~29,5 dias, então 31 dias bastam.
function proximo(de: Date, alvo: number): Date {
  const dist = (t: number) => {
    const p = SunCalc.getMoonIllumination(new Date(t)).phase;
    return ((p - alvo + 1.5) % 1) - 0.5;   // -0,5 a 0,5: negativo antes do alvo, positivo depois
  };
  const H = 3600000;
  let a = de.getTime();
  for (let i = 0; i < 31 * 24; i++) {
    const b = a + H;
    if (dist(a) < 0 && dist(b) >= 0) {
      let lo = a, hi = b;
      for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (dist(m) < 0) lo = m; else hi = m; }
      return new Date(hi);
    }
    a = b;
  }
  return new Date(a);
}

/** Dados da Lua para o instante 'agora'. Sem coordenadas, nascer e pôr ficam nulos (a fase não depende do lugar). */
export function calculaLua(agora: Date, lat?: number | null, lon?: number | null): Lua {
  const il = SunCalc.getMoonIllumination(agora);
  const fase = Math.round(il.phase * 8) % 8;
  const temLugar = lat != null && lon != null;
  const t = temLugar ? SunCalc.getMoonTimes(agora, lat, lon) : null;
  return {
    fase, nome: FASES[fase], ciclo: il.phase,
    iluminacao: Math.round(il.fraction * 100),
    crescendo: il.phase < 0.5,
    nasce: t?.rise ?? null, poe: t?.set ?? null,
    sempreAcima: !!t?.alwaysUp, sempreAbaixo: !!t?.alwaysDown,
    proximaCheia: proximo(agora, 0.5),
    proximaNova: proximo(agora, 0),
  };
}

/** Nascer e pôr do Sol pelas coordenadas (usado quando o tempo da OpenWeatherMap não está disponível). */
export function solPorCoordenadas(agora: Date, lat: number, lon: number) {
  const s = SunCalc.getTimes(agora, lat, lon);
  const ok = (d: Date) => (isNaN(d.getTime()) ? null : d);
  return { nasce: ok(s.sunrise), poe: ok(s.sunset) };
}

/**
 * Caminho SVG da parte iluminada da Lua (círculo de raio r centrado em cx, cy).
 * O lado iluminado é o direito na Lua crescente vista do hemisfério norte; no sul, inverte.
 */
export function caminhoLua(cx: number, cy: number, r: number, iluminacao: number, crescendo: boolean, sul: boolean) {
  const f = Math.max(0, Math.min(1, iluminacao / 100));
  const rx = r * Math.abs(1 - 2 * f);           // largura do terminador (elipse)
  const direita = crescendo !== sul;             // lado iluminado
  const s1 = direita ? 1 : 0;                    // borda: semicírculo do lado iluminado
  const s2 = (f < 0.5) === direita ? 0 : 1;      // terminador: curva para dentro (crescente) ou para fora (gibosa)
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${s1} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${s2} ${cx} ${cy - r} Z`;
}
