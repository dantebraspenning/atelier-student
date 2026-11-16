import 'server-only';
import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';

export function errorResponse(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.key, values: e.values }, { status: e.status });
  console.error(JSON.stringify({ level: 'error', msg: 'route failed', error: String(e), stack: (e as Error)?.stack }));
  return NextResponse.json({ error: 'unexpected' }, { status: 500 });
}

/** Reject cross-site writes to route handlers (server actions have their own origin check). */
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return !origin || (!!host && new URL(origin).host === host);
}
