import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request) {
  // بنجمع الكوكيز اللي @supabase/ssr عايز يحدّثها، وبعدين بنطبّقها على رد جديد سليم.
  // ملاحظة: Next 16 بيكسر لو مرّرنا الطلب كامل لـ NextResponse.next({ request })
  // (الصفحة الرئيسية كانت بترجّع 404)، فبنستخدم نمط @supabase/ssr الرسمي.
  const cookiesToSet = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) { items.forEach(({ name, value, options }) => cookiesToSet.push({ name, value, options })); },
      },
    },
  );

  const result = await supabase.auth.getUser();
  const user = result.data.user;

  function withCookies(response) {
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard') && user?.app_metadata?.role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return withCookies(NextResponse.redirect(url));
  }
  if (request.nextUrl.pathname === '/' && user?.app_metadata?.role === 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return withCookies(NextResponse.redirect(url));
  }
  return withCookies(NextResponse.next());
}

export const config = { matcher: ['/', '/dashboard/:path*'] };
