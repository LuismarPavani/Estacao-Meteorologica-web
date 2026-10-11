import { NextRequest, NextResponse } from 'next/server';
import { isPublicDevice } from '@/lib/public';
import { fetchReadings } from '@/lib/readings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const device = req.nextUrl.searchParams.get('device') ?? '';
  if (!device || !(await isPublicDevice(device))) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const city = Number(req.nextUrl.searchParams.get('city')) || null;
  const hours = Math.min(Number(req.nextUrl.searchParams.get('hours')) || 24, 720);
  const rows = await fetchReadings(device, hours, city);
  if (!rows) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(rows);
}
