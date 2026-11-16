import type { DB } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';

export async function audit(db: DB, actorId: string | null, action: string, entityType: string, entityId: string, data: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({ actorId, action, entityType, entityId, data });
}
