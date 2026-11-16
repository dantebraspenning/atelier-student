import { afterAll, expect, test } from 'vitest';
import { sql } from 'drizzle-orm';
import { closeDb, getDb } from '@/lib/db';

afterAll(closeDb);

test('embedded Postgres migrates the full schema', async () => {
  const db = await getDb();
  const r = await db.execute(sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
  const rows = (r as unknown as { rows: { n: number }[] }).rows;
  expect(rows[0].n).toBeGreaterThanOrEqual(24);
});
