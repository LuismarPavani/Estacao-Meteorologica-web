import { NextRequest, NextResponse } from 'next/server';
import { publicOwmKey } from '@/lib/public';
import { getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Camadas do mapa da OpenWeatherMap (Weather maps 1.0, inclusas no plano gratuito)
const CAMADAS: Record<string, string> = {
  temp: 'temp_new', chuva: 'precipitation_new', nuvens: 'clouds_new', vento: 'wind_new', pressao: 'pressure_new',
};

// Quadrado (tile) de uma camada do mapa, buscado com a chave do usuário logado: a chave nunca vai ao
// navegador. Fica 10 min em cache no navegador e na CDN, para poupar a cota da OpenWeatherMap.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ camada: string; z: string; x: string; y: string }> }) {
  const u = await getUser();
  if (!u) return unauthorized();
  const p = await params;
  const camada = CAMADAS[p.camada];
  const [z, x, y] = [p.z, p.x, p.y].map(Number);
  const max = 2 ** z;
  if (!camada || ![z, x, y].every(Number.isInteger) || z < 0 || z > 12 || x < 0 || y < 0 || x >= max || y >= max)
    return NextResponse.json({ error: 'invalid tile' }, { status: 400 });

  // Chave do usuário; sem ela, a mesma da página pública (OWM_PUBLIC_KEY ou a de um admin)
  const { data } = await supabase.from('users').select('owm_key').eq('id', u.id).single();
  const key = (data?.owm_key as string | undefined) || (await publicOwmKey());
  if (!key) return NextResponse.json({ error: 'no_key' }, { status: 400 });

  const r = await fetch(`https://tile.openweathermap.org/map/${camada}/${z}/${x}/${y}.png?appid=${encodeURIComponent(key)}`,
    { cache: 'no-store' });
  if (!r.ok) return NextResponse.json({ error: r.status === 401 ? 'invalid_key' : 'owm_error' }, { status: 502 });
  return new NextResponse(await r.arrayBuffer(), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=600, s-maxage=600' },
  });
}
