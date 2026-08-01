import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  
  // Public routes that don't need auth checking for redirect (e.g. login, api routes)
  if (url.pathname.startsWith('/login') || url.pathname.startsWith('/api') || url.pathname.startsWith('/_next')) {
    if (user && url.pathname === '/login') {
      // If user is logged in and tries to access login page, redirect them.
      // But we need to know where to redirect them (admin or student).
      // We will handle this by simply redirecting to a check route or dashboard and letting it route.
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // If there's no user, redirect to login
  if (!user) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Fetch the user's profile to check role and must_change_password flag
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, must_change_password')
    .eq('id', user.id)
    .single()

  // Handle password reset enforcement
  if (profile?.must_change_password && url.pathname !== '/change-password') {
    url.pathname = '/change-password'
    return NextResponse.redirect(url)
  }
  
  if (!profile?.must_change_password && url.pathname === '/change-password') {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Handle Role-Based Access Control (RBAC)
  if (url.pathname.startsWith('/admin') && profile?.role !== 'admin') {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (url.pathname === '/') {
    url.pathname = profile?.role === 'admin' ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
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
