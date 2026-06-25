import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  let ADMIN_SECRET = process.env.STARLINKNET_WIFI_ADMIN_SECRET || 'NJERI';
  // Strip quotes to avoid mismatch from .env file literals
  ADMIN_SECRET = ADMIN_SECRET.replace(/['"]+/g, '');

  const authCookie = request.cookies.get('starlinknet_wifi_admin_auth');
  const isAuthenticated = authCookie?.value === ADMIN_SECRET;

  const url = request.nextUrl.clone();

  // Protect Admin Pages
  if (url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login')) {
    if (!isAuthenticated) {
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  // Allow public access to GET /api/admin/offers so users can see plans
  const isPublicGetOffers = url.pathname === '/api/admin/offers' && request.method === 'GET';

  // Protect Admin API Routes (Allow login/logout/public GET offers)
  if (url.pathname.startsWith('/api/admin') &&
      !url.pathname.startsWith('/api/admin/login') &&
      !url.pathname.startsWith('/api/admin/logout') &&
      !isPublicGetOffers) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Redirect authenticated users away from login
  if (url.pathname === '/admin/login' && isAuthenticated) {
    url.pathname = '/admin/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/api/admin/:path*'],
};
