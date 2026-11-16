/**
 * Runs once when the server starts.
 * - Production: refuse to start with missing configuration (better than failing on the first payment).
 * - Development: connect (and migrate) the embedded database and load demo data into an empty one.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { env, missingProductionConfig } = await import('@/lib/env');
  if (env().NODE_ENV === 'production') {
    const missing = missingProductionConfig();
    if (missing.length && process.env.ALLOW_INCOMPLETE_CONFIG !== '1') {
      throw new Error(`Missing production configuration: ${missing.join(', ')} (see .env.example)`);
    }
    return;
  }
  const { getDb } = await import('@/lib/db');
  const db = await getDb();
  if (process.env.SEED_DEMO !== 'false') {
    const { seedDemo, DEMO_PASSWORD } = await import('@/lib/seed');
    if (await seedDemo(db)) console.info(`[seed] Demo data loaded. Log in as noor@demo.atelier.test, sara@demo.atelier.test or admin@demo.atelier.test (password: ${DEMO_PASSWORD}).`);
  }
}

export async function onRequestError(error: unknown, request: { path: string; method: string }) {
  console.error(JSON.stringify({ level: 'error', msg: 'request failed', path: request.path, method: request.method, error: String(error), stack: (error as Error)?.stack }));
}
