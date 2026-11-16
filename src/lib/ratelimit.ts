import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { fail } from '@/lib/errors';

/**
 * Fixed-window limiter stored in Postgres, so it holds across server instances.
 * Throws `errors.rateLimited` when the limit is exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const db = await getDb();
  const res = await db.execute(sql`
    insert into app_rate_limit (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when app_rate_limit.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else app_rate_limit.count + 1 end,
      window_start = case when app_rate_limit.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else app_rate_limit.window_start end
    returning count`);
  const rows = (res as unknown as { rows: { count: number }[] }).rows;
  if (rows[0].count > limit) fail('rateLimited', 429);
}
