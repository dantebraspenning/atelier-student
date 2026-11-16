import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getAuth } from '@/lib/auth';
import type { Role } from '@/lib/db/schema';
import type { Actor } from '@/lib/domain/types';
import { fail } from '@/lib/errors';

/** The signed-in user for this request (cached per request), or null. Suspended/deleted accounts count as signed out. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: Role; locale?: string; suspendedAt?: Date | null; deletedAt?: Date | null };
  if (u.suspendedAt || u.deletedAt) return null;
  return { id: u.id, role: (u.role ?? 'customer') as Role, name: u.name, email: u.email, locale: u.locale === 'en' ? 'en' : 'nl' };
});

/** For server actions: throws an AppError when not signed in or not allowed. */
export async function requireActor(role?: Role | Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) return fail('signInRequired', 401);
  if (role && !(Array.isArray(role) ? role : [role]).includes(actor.role)) fail('forbidden', 403);
  return actor;
}

/** For pages: redirects to sign-in (or the user's home) instead of throwing. */
export async function requirePageActor(locale: string, path: string, role?: Role | Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/${locale}/sign-in?next=${encodeURIComponent(path)}`);
  if (role && !(Array.isArray(role) ? role : [role]).includes(actor.role)) redirect(`/${locale}${homeFor(actor.role)}`);
  return actor;
}

export const homeFor = (role: Role) => (role === 'student' ? '/studio' : role === 'admin' ? '/admin' : '/requests');
