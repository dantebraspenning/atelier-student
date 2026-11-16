import { ZodError } from 'zod';

/**
 * An expected, user-facing failure. `key` is a translation key under `errors.*`
 * so the UI can show the message in the user's language.
 */
export class AppError extends Error {
  constructor(public key: string, public status = 400, public values?: Record<string, string | number>) {
    super(key);
    this.name = 'AppError';
  }
}

export const fail = (key: string, status = 400, values?: Record<string, string | number>): never => {
  throw new AppError(key, status, values);
};

export const notFound = (): never => fail('notFound', 404);
export const forbidden = (): never => fail('forbidden', 403);

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; values?: Record<string, string | number> };

/** Run a server action body and turn AppErrors into a serialisable result. Unexpected errors are logged and hidden. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  let data: T;
  try {
    data = await fn();
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.key, values: err.values };
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return { ok: false, error: 'invalidInput', values: { field: String(issue?.path?.join('.') ?? '') } };
    }
    // Let Next.js redirects / notFound propagate.
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: unknown }).digest === 'string'
      && /NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR)/.test((err as { digest: string }).digest)) throw err;
    console.error(JSON.stringify({ level: 'error', msg: 'action failed', error: String(err), stack: (err as Error)?.stack }));
    return { ok: false, error: 'unexpected' };
  }
  // `{ redirect }` results navigate server-side (also to Stripe), so the page refresh after an action can't swallow them.
  if (data && typeof data === 'object' && 'redirect' in data && typeof (data as { redirect: unknown }).redirect === 'string') {
    const { redirect } = await import('next/navigation');
    redirect((data as { redirect: string }).redirect);
  }
  return { ok: true, data };
}
