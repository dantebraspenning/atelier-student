import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { getDb, type DB } from '@/lib/db';
import { account, rateLimit, session, studentProfile, user, verification } from '@/lib/db/schema';
import { env, isProduction } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { slugify } from '@/lib/slug';

const DEV_SECRET = 'development-only-secret-do-not-use-in-production-0123456789';

export async function uniqueSlug(db: DB, name: string) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db.select({ id: studentProfile.userId }).from(studentProfile).where(eq(studentProfile.slug, candidate)).limit(1);
    if (!taken.length) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function build(db: DB) {
  const secret = env().BETTER_AUTH_SECRET ?? (isProduction() ? undefined : DEV_SECRET);
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required in production');
  const localeOf = (u: { locale?: unknown }) => (u.locale === 'en' ? 'en' : 'nl') as 'nl' | 'en';

  return betterAuth({
    appName: 'Atelier Student',
    baseURL: env().APP_URL,
    secret,
    trustedOrigins: [env().APP_URL],
    database: drizzleAdapter(db as never, { provider: 'pg', schema: { user, session, account, verification, rateLimit } }),
    advanced: { useSecureCookies: isProduction(), database: { generateId: () => crypto.randomUUID() } },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user: u, url }) => {
        await sendEmail({ to: u.email, template: 'resetPassword', locale: localeOf(u as never), values: { name: u.name }, url });
      }
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user: u, url }) => {
        await sendEmail({ to: u.email, template: 'verifyEmail', locale: localeOf(u as never), values: { name: u.name }, url });
      },
      afterEmailVerification: async (u) => {
        // Configured admin addresses get the admin role once they prove they own the inbox.
        if (env().ADMIN_EMAILS.includes(u.email.toLowerCase())) {
          await db.update(user).set({ role: 'admin' }).where(eq(user.id, u.id));
        }
      }
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'customer', input: true },
        locale: { type: 'string', required: false, defaultValue: 'nl', input: true },
        notifyMessages: { type: 'boolean', required: false, defaultValue: true, input: false },
        suspendedAt: { type: 'date', required: false, input: false },
        deletedAt: { type: 'date', required: false, input: false }
      }
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 10 },
        '/request-password-reset': { window: 60 * 60, max: 5 },
        '/send-verification-email': { window: 60 * 60, max: 5 }
      }
    },
    databaseHooks: {
      user: {
        create: {
          // Nobody can sign themselves up as admin.
          before: async (u) => ({
            data: { ...u, role: u.role === 'student' ? 'student' : 'customer', locale: u.locale === 'en' ? 'en' : 'nl' }
          }),
          after: async (u) => {
            if (u.role === 'student') {
              await db.insert(studentProfile).values({ userId: u.id, slug: await uniqueSlug(db, u.name) }).onConflictDoNothing();
            }
          }
        }
      },
      session: {
        create: {
          // Suspended or deleted accounts cannot sign in.
          before: async (s) => {
            const [u] = await db.select({ suspendedAt: user.suspendedAt, deletedAt: user.deletedAt }).from(user).where(eq(user.id, s.userId));
            if (!u || u.suspendedAt || u.deletedAt) return false;
          }
        }
      }
    },
    plugins: [nextCookies()]
  });
}

export type Auth = ReturnType<typeof build>;
const holder = ((globalThis as unknown as { __atelierAuth?: { auth?: Promise<Auth> } }).__atelierAuth ??= {});

export function getAuth(): Promise<Auth> {
  holder.auth ??= getDb().then(build);
  return holder.auth;
}
