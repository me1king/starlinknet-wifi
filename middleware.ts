import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * STARLINKNET SECURITY MIDDLEWARE
 * -------------------------------
 * This middleware protects the admin dashboard from unauthorized access.
 * It checks for the 'starlinknet_wifi_admin_auth' cookie before allowing access to /admin paths.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Define paths that REQUIRE authentication
  const isProtectedPath = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isProtectedApi = pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/login');

  if (isProtectedPath || isProtectedApi) {
    const authCookie = request.cookies.get('starlinknet_wifi_admin_auth');
    const ADMIN_SECRET = (process.env.STARLINKNET_WIFI_ADMIN_SECRET || 'NJERI').replace(/['"]+/g, '');

    // Check if cookie exists AND matches the secret
    if (!authCookie || authCookie.value !== ADMIN_SECRET) {
      console.warn(`[Security] Unauthorized access attempt to ${pathname}`);

      // If it's an API call, return 401 Unauthorized
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized access. Please login.' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }

      // If it's a page request, redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
