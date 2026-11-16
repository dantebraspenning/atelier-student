import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { env } from '@/lib/env';
import * as schema from './schema';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

type Holder = { db?: DB; ready?: Promise<void>; close?: () => Promise<void> };
// Survive hot reloads in development: one embedded database per process.
const holder: Holder = ((globalThis as unknown as { __atelierDb?: Holder }).__atelierDb ??= {});

async function create(): Promise<void> {
  const url = env().DATABASE_URL;
  if (url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const client = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 10), prepare: false });
    holder.db = drizzle(client, { schema }) as unknown as DB;
    holder.close = () => client.end();
    return;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const dir = env().PGLITE_DIR;
  if (dir !== 'memory://') (await import('node:fs')).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir === 'memory://' ? undefined : dir);
  await client.waitReady;
  holder.db = drizzle(client, { schema }) as unknown as DB;
  holder.close = () => client.close();
  // The embedded database migrates itself; a real Postgres is migrated with `npm run db:migrate`.
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  await migrate(holder.db as never, { migrationsFolder: migrationsFolder() });
}

export function migrationsFolder() {
  return (process.env.MIGRATIONS_DIR ?? `${process.cwd()}/drizzle`);
}

/** The database, connected (and for the embedded database, migrated) on first use. */
export async function getDb(): Promise<DB> {
  holder.ready ??= create();
  await holder.ready;
  return holder.db!;
}

export async function closeDb() {
  if (holder.close) await holder.close();
  holder.db = undefined; holder.ready = undefined; holder.close = undefined;
}

export { schema };
