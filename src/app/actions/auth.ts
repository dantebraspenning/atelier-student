'use server';

import { headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AppError, fail, runAction } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { clientIp, localeOf, safeNext, str } from '@/lib/request-meta';
import { homeFor, requireActor } from '@/lib/session';

const CODES: Record<string, string> = {
  USER_ALREADY_EXISTS: 'emailTaken',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'emailTaken',
  INVALID_EMAIL_OR_PASSWORD: 'invalidCredentials',
  INVALID_PASSWORD: 'invalidCredentials',
  EMAIL_NOT_VERIFIED: 'emailNotVerified',
  PASSWORD_TOO_SHORT: 'passwordTooShort',
  PASSWORD_TOO_LONG: 'passwordTooLong',
  INVALID_EMAIL: 'invalidEmail',
  INVALID_TOKEN: 'invalidToken',
  USER_NOT_FOUND: 'invalidCredentials'
};

/** Translate Better Auth errors into our error keys. */
async function auth<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e instanceof APIError) {
      const code = (e.body as { code?: string } | undefined)?.code ?? '';
      if (e.status === 'TOO_MANY_REQUESTS' || e.statusCode === 429) fail('rateLimited', 429);
      throw new AppError(CODES[code] ?? (e.statusCode === 403 ? 'forbidden' : 'unexpected'), e.statusCode ?? 400);
    }
    throw e;
  }
}

export async function signUpAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const locale = localeOf(fd);
    await rateLimit(`signup:${await clientIp()}`, 10, 60 * 60);
    const role = str(fd, 'role') === 'student' ? 'student' : 'customer';
    const email = str(fd, 'email').toLowerCase();
    const name = str(fd, 'name');
    if (name.length < 2) fail('invalidInput', 400, { field: 'name' });
    const next = str(fd, 'next');
    const a = await getAuth();
    await auth(async () => a.api.signUpEmail({
      body: { name, email, password: String(fd.get('password') ?? ''), role, locale, callbackURL: `/${locale}/welcome${next ? `?next=${encodeURIComponent(next)}` : ''}` },
      headers: await headers()
    }));
    return { redirect: `/${locale}/check-email?email=${encodeURIComponent(email)}` };
  });
}

export async function signInAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const locale = localeOf(fd);
    const email = str(fd, 'email').toLowerCase();
    await rateLimit(`signin:${await clientIp()}`, 20, 15 * 60);
    await rateLimit(`signin-email:${email}`, 8, 15 * 60);
    const a = await getAuth();
    const res = await auth(async () => a.api.signInEmail({
      body: { email, password: String(fd.get('password') ?? ''), callbackURL: `/${locale}/welcome` },
      headers: await headers()
    }));
    const role = (res.user as { role?: 'customer' | 'student' | 'admin' }).role ?? 'customer';
    return { redirect: safeNext(str(fd, 'next') || null, locale, homeFor(role)) };
  });
}

export async function signOutAction(fd: FormData) {
  const a = await getAuth();
  await a.api.signOut({ headers: await headers() }).catch(() => undefined);
  const { redirect } = await import('next/navigation');
  redirect(`/${localeOf(fd)}`);
}

export async function forgotPasswordAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const locale = localeOf(fd);
    await rateLimit(`forgot:${await clientIp()}`, 10, 60 * 60);
    const a = await getAuth();
    // Same answer whether or not the account exists.
    await a.api.requestPasswordReset({ body: { email: str(fd, 'email').toLowerCase(), redirectTo: `/${locale}/reset-password` }, headers: await headers() }).catch(() => undefined);
  });
}

export async function resetPasswordAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const a = await getAuth();
    await auth(async () => a.api.resetPassword({ body: { newPassword: String(fd.get('password') ?? ''), token: str(fd, 'token') }, headers: await headers() }));
    return { redirect: `/${localeOf(fd)}/sign-in?reset=1` };
  });
}

export async function resendVerificationAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    await rateLimit(`resend:${await clientIp()}`, 5, 60 * 60);
    const a = await getAuth();
    const locale = localeOf(fd);
    await a.api.sendVerificationEmail({ body: { email: str(fd, 'email').toLowerCase(), callbackURL: `/${locale}/welcome` }, headers: await headers() }).catch(() => undefined);
  });
}

export async function changePasswordAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    await requireActor();
    const a = await getAuth();
    await auth(async () => a.api.changePassword({
      body: { currentPassword: String(fd.get('current') ?? ''), newPassword: String(fd.get('password') ?? ''), revokeOtherSessions: true },
      headers: await headers()
    }));
  });
}

export async function setLocaleAction(locale: 'nl' | 'en') {
  const actor = await requireActor().catch(() => null);
  if (!actor) return;
  const db = await getDb();
  await db.update(user).set({ locale }).where(eq(user.id, actor.id));
}
