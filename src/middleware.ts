import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicEnv } from '@/lib/env'

function redirectWithCookies(targetUrl: URL, sourceResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(targetUrl)
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })
  return redirectResponse
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabasePublicEnv()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Allow API and Next.js internal routes directly
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_next')) {
    return supabaseResponse
  }

  // Unauthenticated users can only access /login
  if (!user) {
    if (url.pathname.startsWith('/login')) {
      return supabaseResponse
    }
    url.pathname = '/login'
    return redirectWithCookies(url, supabaseResponse)
  }

  // For Server Action POST requests, session refresh is done above and each action validates RBAC itself
  if (request.method === 'POST' && request.headers.has('next-action')) {
    return supabaseResponse
  }

  // Fetch the authenticated user's profile to check role and must_change_password flag
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, must_change_password')
    .eq('id', user.id)
    .single()

  const homePath = profile?.role === 'admin' ? '/admin' : '/dashboard'

  // Handle password reset enforcement
  if (profile?.must_change_password && url.pathname !== '/change-password') {
    url.pathname = '/change-password'
    return redirectWithCookies(url, supabaseResponse)
  }

  if (!profile?.must_change_password && url.pathname === '/change-password') {
    url.pathname = homePath
    return redirectWithCookies(url, supabaseResponse)
  }

  // Redirect already authenticated users away from /login to their proper home route
  if (url.pathname.startsWith('/login')) {
    url.pathname = homePath
    return redirectWithCookies(url, supabaseResponse)
  }

  // Handle Role-Based Access Control (RBAC)
  if (url.pathname.startsWith('/admin') && profile?.role !== 'admin') {
    url.pathname = '/dashboard'
    return redirectWithCookies(url, supabaseResponse)
  }

  if (url.pathname === '/') {
    url.pathname = homePath
    return redirectWithCookies(url, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
