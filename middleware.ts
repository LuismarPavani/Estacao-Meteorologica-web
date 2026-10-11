import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === '/' ||                       // página pública
    pathname === '/login' ||
    pathname === '/api/login' ||
    pathname.startsWith('/api/public/') ||
    (pathname === '/api/readings' && req.method === 'POST'); // ESP usa x-device-key
  if (isPublic) return NextResponse.next();

  if (await verifySession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/'))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

// Arquivos do app (PWA) não passam pelo middleware
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|icons/).*)'],
};
