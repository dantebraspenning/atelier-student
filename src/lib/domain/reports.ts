import { z } from 'zod';
import { getDb } from '@/lib/db';
import { report, REPORT_TARGETS } from '@/lib/db/schema';
import { rateLimit } from '@/lib/ratelimit';
import { alertAdmins } from './notify';
import type { Actor } from './types';

export const reportInput = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().min(1).max(80),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'scam', 'off_platform_payment', 'other']),
  details: z.string().trim().max(2000).default('')
});

/** DSA notice-and-action: report a person or piece of content to the moderators. */
export async function createReport(actor: Actor, input: z.input<typeof reportInput>) {
  const v = reportInput.parse(input);
  await rateLimit(`report:${actor.id}`, 20, 24 * 60 * 60);
  const db = await getDb();
  await db.insert(report).values({ reporterId: actor.id, ...v });
  await alertAdmins(`Report: ${v.targetType} (${v.reason})`, v.details || 'No details given.', '/admin/reports');
}
