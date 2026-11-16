import { z } from 'zod';

const list = z.string().optional().transform((v) => (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const empty = (v: unknown) => (v === '' ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.preprocess(empty, z.url().default('http://localhost:3000')),
  DATABASE_URL: z.preprocess(empty, z.string().optional()),
  PGLITE_DIR: z.preprocess(empty, z.string().default('.data/pglite')),
  BETTER_AUTH_SECRET: z.preprocess(empty, z.string().min(32).optional()),
  ENCRYPTION_KEY: z.preprocess(empty, z.string().optional()),
  CRON_SECRET: z.preprocess(empty, z.string().min(16).optional()),
  STRIPE_SECRET_KEY: z.preprocess(empty, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(empty, z.string().optional()),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(10),
  AUTO_RELEASE_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  SMTP_URL: z.preprocess(empty, z.string().optional()),
  EMAIL_FROM: z.preprocess(empty, z.string().default('Atelier Student <hello@localhost>')),
  SUPPORT_EMAIL: z.preprocess(empty, z.string().default('support@localhost')),
  S3_BUCKET: z.preprocess(empty, z.string().optional()),
  S3_REGION: z.preprocess(empty, z.string().default('auto')),
  S3_ENDPOINT: z.preprocess(empty, z.string().optional()),
  S3_ACCESS_KEY_ID: z.preprocess(empty, z.string().optional()),
  S3_SECRET_ACCESS_KEY: z.preprocess(empty, z.string().optional()),
  UPLOAD_DIR: z.preprocess(empty, z.string().default('.data/uploads')),
  SCHOOL_EMAIL_DOMAINS: list,
  ADMIN_EMAILS: list,
  COMPANY_NAME: z.preprocess(empty, z.string().default('Atelier Student')),
  COMPANY_KVK: z.preprocess(empty, z.string().default('')),
  COMPANY_ADDRESS: z.preprocess(empty, z.string().default(''))
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parsed environment. Read lazily so that `next build` works without runtime secrets. */
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export const isProduction = () => env().NODE_ENV === 'production';
export const paymentsSimulated = () => !env().STRIPE_SECRET_KEY;
export const emailLoggedOnly = () => !env().SMTP_URL;

/** Every setting a real launch needs. Called at server start in production. */
export function missingProductionConfig(): string[] {
  const e = env();
  const missing: string[] = [];
  if (!e.DATABASE_URL) missing.push('DATABASE_URL');
  if (!e.BETTER_AUTH_SECRET) missing.push('BETTER_AUTH_SECRET');
  if (!e.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');
  if (!e.CRON_SECRET) missing.push('CRON_SECRET');
  if (!e.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!e.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!e.SMTP_URL) missing.push('SMTP_URL');
  if (e.APP_URL.startsWith('http://localhost')) missing.push('APP_URL');
  return missing;
}
