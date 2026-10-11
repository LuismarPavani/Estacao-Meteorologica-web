import { NextRequest, NextResponse } from 'next/server';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };
const err = (m: string) => NextResponse.json({ error: m }, { status: 400 });
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

export async function PUT(req: NextRequest, { params }: Ctx) {
  const u = await getUser();
  if (!u) return unauthorized();
  const { id } = await params;
  if (!(await canAccessDevice(u, id))) return forbidden();
  const b = await req.json();

  const temp_min = num(b.temp_min), temp_max = num(b.temp_max), hum_min = num(b.hum_min), hum_max = num(b.hum_max);
  const bat = num(b.battery_min);
  if ([temp_min, temp_max, hum_min, hum_max, bat].some(v => v !== null && !Number.isFinite(v))) return err('Use apenas números nos limites.');
  if ([temp_min, temp_max].some(v => v !== null && (v! < -50 || v! > 100))) return err('Temperatura entre -50 e 100 °C.');
  if ([hum_min, hum_max].some(v => v !== null && (v! < 0 || v! > 100))) return err('Umidade entre 0 e 100 %.');
  if (bat !== null && (bat < 1 || bat > 100)) return err('Bateria entre 1 e 100 %.');
  if (temp_min !== null && temp_max !== null && temp_min >= temp_max) return err('A temperatura mínima precisa ser menor que a máxima.');
  if (hum_min !== null && hum_max !== null && hum_min >= hum_max) return err('A umidade mínima precisa ser menor que a máxima.');

  const { data: rule, error } = await supabase.from('alert_rules').upsert({
    user_id: u.id, device_id: id, enabled: b.enabled !== false,
    temp_min, temp_max, hum_min, hum_max, battery_min: bat === null ? null : Math.round(bat),
    notify_recovery: b.notify_recovery !== false,
  }, { onConflict: 'user_id,device_id' }).select().single();
  if (error) {
    console.error('alert_rules upsert', error.message);
    return NextResponse.json({ error: 'Erro ao salvar. Confira se o migration-v3.sql foi executado.' }, { status: 500 });
  }
  // Limites novos: reavalia do zero na próxima leitura
  await supabase.from('alert_state').delete().eq('user_id', u.id).eq('device_id', id);
  return NextResponse.json({ ok: true, rule });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await getUser();
  if (!u) return unauthorized();
  const { id } = await params;
  await supabase.from('alert_rules').delete().eq('user_id', u.id).eq('device_id', id);
  return NextResponse.json({ ok: true });
}
