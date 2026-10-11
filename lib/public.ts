import { supabase } from './supabase';

export async function isPublicDevice(id: string) {
  const { data } = await supabase.from('devices').select('id').eq('id', id).eq('is_public', true).maybeSingle();
  return !!data;
}

// A página pública só consulta cidades que um ESP público já enviou
export async function publicCityAllowed(device: string, city: number) {
  if (!(await isPublicDevice(device))) return false;
  const { data } = await supabase.from('device_cities').select('city_id').eq('device_id', device).eq('city_id', city).maybeSingle();
  return !!data;
}

// Chave da OpenWeatherMap da página pública, em ordem: OWM_PUBLIC_KEY, a do usuário principal (ADMIN_USER)
// e, se ele não tiver, a de qualquer admin que tenha cadastrado uma
export async function publicOwmKey() {
  if (process.env.OWM_PUBLIC_KEY) return process.env.OWM_PUBLIC_KEY;
  const root = process.env.ADMIN_USER?.trim().toLowerCase();
  if (root) {
    const { data } = await supabase.from('users').select('owm_key').eq('username', root).maybeSingle();
    if (data?.owm_key) return data.owm_key as string;
  }
  const { data: admins } = await supabase.from('users').select('owm_key')
    .eq('role', 'admin').not('owm_key', 'is', null).limit(1);
  return (admins?.[0]?.owm_key as string | undefined) ?? null;
}
