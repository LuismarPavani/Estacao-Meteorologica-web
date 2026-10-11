const BASE = 'https://api.openweathermap.org/data/2.5';
const FORECAST_DAYS = 4; // quantos dias à frente mostrar (a API gratuita cobre até 5)

type Res = { status: number; body: unknown };

async function call(path: string, city: number, key: string) {
  // Cache de 5 min no servidor: protege a cota da OpenWeatherMap, principalmente na página pública
  return fetch(`${BASE}/${path}?id=${city}&units=metric&lang=pt_br&appid=${encodeURIComponent(key)}`, { next: { revalidate: 300 } });
}
const fail = (r: Response): Res =>
  r.status === 401 ? { status: 400, body: { error: 'invalid_key' } } : { status: 502, body: { error: 'owm_error' } };

export async function getWeather(city: number, key: string): Promise<Res> {
  const r = await call('weather', city, key);
  if (!r.ok) return fail(r);
  const w = await r.json();
  return {
    status: 200,
    body: {
      name: w.name, description: w.weather?.[0]?.description, icon: w.weather?.[0]?.icon,
      temp: w.main?.temp, feels_like: w.main?.feels_like, humidity: w.main?.humidity,
      pressure: w.main?.pressure, wind_kmh: w.wind?.speed != null ? Math.round(w.wind.speed * 3.6) : null,
      sunrise: w.sys?.sunrise, sunset: w.sys?.sunset, dt: w.dt, timezone: w.timezone ?? 0,
    },
  };
}

// Previsão: junta os blocos de 3 em 3 horas da OpenWeatherMap em um resumo por dia
export async function getForecast(city: number, key: string): Promise<Res> {
  const r = await call('forecast', city, key);
  if (!r.ok) return fail(r);
  const f = await r.json();
  const tz: number = f.city?.timezone ?? 0;
  const local = (sec: number) => new Date((sec + tz) * 1000).toISOString(); // hora local da cidade
  const today = local(Date.now() / 1000).slice(0, 10);

  type Acc = { min: number; max: number; pop: number; best: { diff: number; icon: string; description: string } };
  const byDay = new Map<string, Acc>();
  for (const it of f.list ?? []) {
    const iso = local(it.dt), date = iso.slice(0, 10);
    if (date <= today) continue;
    const diff = Math.abs(Number(iso.slice(11, 13)) - 13); // o bloco mais perto do início da tarde representa o dia
    const a = byDay.get(date) ?? { min: Infinity, max: -Infinity, pop: 0, best: { diff: 99, icon: '01d', description: '' } };
    a.min = Math.min(a.min, it.main?.temp_min ?? it.main?.temp);
    a.max = Math.max(a.max, it.main?.temp_max ?? it.main?.temp);
    a.pop = Math.max(a.pop, it.pop ?? 0);
    if (diff < a.best.diff) a.best = { diff, icon: it.weather?.[0]?.icon ?? '01d', description: it.weather?.[0]?.description ?? '' };
    byDay.set(date, a);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, FORECAST_DAYS)
    .map(([date, a]) => ({
      date, min: a.min, max: a.max, pop: Math.round(a.pop * 100),
      icon: a.best.icon.replace('n', 'd'), description: a.best.description,
    }));
  return { status: 200, body: days };
}
