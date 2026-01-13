import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // Skip static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Public routes - no auth required
  const publicRoutes = ['/login', '/signup', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For API routes, let them handle their own auth (return 401)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // For page routes, check session and redirect if not authenticated
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value;
          },
          set(name, value, options) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name, options) {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    console.log(`🔐 [Middleware] Path: ${pathname}, Has Session: ${!!session}`);

    // NO SESSION = REDIRECT TO LOGIN (not "allow")
    if (!session) {
      console.log(`🔐 [Middleware] BLOCKING - Redirecting to /login`);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // If user has session and is on login page, redirect to intended destination or /ideas
    if (session && pathname === '/login') {
      const redirectPath = request.nextUrl.searchParams.get('redirect') || '/ideas';
      // Ignore '/' as redirect target
      const finalPath = redirectPath === '/' ? '/ideas' : redirectPath;
      console.log(`🔐 [Middleware] Has session, redirecting from /login to ${finalPath}`);
      return NextResponse.redirect(new URL(finalPath, request.url));
    }

    return response;
  } catch (error) {
    console.error('🔐 [Middleware] Error:', error.message);
    // On error, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
