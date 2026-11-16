import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

/**
 * 1. Paths without a locale (e.g. "/", "/makers") are redirected to the visitor's language by next-intl.
 * 2. Localised pages get a per-request CSP nonce: only scripts rendered by the app itself can run.
 */
export default function proxy(request: NextRequest) {
  const locale = request.nextUrl.pathname.split('/')[1];
  if (!(routing.locales as readonly string[]).includes(locale)) return handleI18nRouting(request);

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests'])
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  headers.set('X-NEXT-INTL-LOCALE', locale);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
