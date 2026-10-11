import { NextRequest, NextResponse } from 'next/server';
import { isPublicDevice } from '@/lib/public';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const device = req.nextUrl.searchParams.get('device') ?? '';
  if (!device || !(await isPublicDevice(device))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { data, error } = await supabase.from('device_cities')
    .select('city_id, city_name').eq('device_id', device).order('last_seen', { ascending: false });
  if (error) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(data);
}
