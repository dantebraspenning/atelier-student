// Apply database migrations to the Postgres in DATABASE_URL. Run on every deploy, before starting the app.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (the local embedded database migrates itself on start).');
  process.exit(1);
}
const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: process.env.MIGRATIONS_DIR ?? 'drizzle' });
await client.end();
console.log('Migrations applied.');
