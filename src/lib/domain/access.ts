import { and, eq } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { commission, message, quote, request, requestPass, studentProfile, user } from '@/lib/db/schema';
import type { Actor } from './types';

type RequestRow = typeof request.$inferSelect;

/** Whether an open request shows up in a student's feed. */
export function visibleInFeed(r: Pick<RequestRow, 'status' | 'targetStudentId' | 'garment'>, studentId: string, specialities: string[]) {
  if (r.status !== 'open') return false;
  if (r.targetStudentId) return r.targetStudentId === studentId;
  return specialities.includes(r.garment);
}

export async function liveCommission(db: DB, requestId: string) {
  const rows = await db.select().from(commission).where(eq(commission.requestId, requestId));
  return rows.find((c) => c.status !== 'cancelled') ?? null;
}

/**
 * Who may read/write the conversation between a request's customer and one student.
 * Returns null when the viewer has no business seeing it.
 */
export async function threadAccess(db: DB, viewer: Pick<Actor, 'id' | 'role'>, requestId: string, studentId: string) {
  const [r] = await db.select().from(request).where(eq(request.id, requestId));
  const [s] = await db.select({ id: user.id, name: user.name, deletedAt: user.deletedAt }).from(user).where(and(eq(user.id, studentId), eq(user.role, 'student')));
  if (!r || !s) return null;
  const [q] = await db.select().from(quote).where(and(eq(quote.requestId, requestId), eq(quote.studentId, studentId)));
  const [m] = await db.select({ id: message.id }).from(message).where(and(eq(message.requestId, requestId), eq(message.studentId, studentId))).limit(1);
  const c = await liveCommission(db, requestId);
  const isMaker = !!c && c.studentId === studentId && c.status !== 'pending_payment';
  let visible = false;
  let openForStudent = false;
  if (viewer.role === 'admin') visible = true;
  else if (viewer.id === r.customerId) visible = !!q || !!m || r.targetStudentId === studentId;
  else if (viewer.id === studentId) {
    const [p] = await db.select({ specialities: studentProfile.specialities }).from(studentProfile).where(eq(studentProfile.userId, studentId));
    const [passed] = await db.select().from(requestPass).where(and(eq(requestPass.requestId, requestId), eq(requestPass.studentId, studentId)));
    openForStudent = !!p && visibleInFeed(r, studentId, p.specialities) && !passed;
    visible = !!q || !!m || openForStudent;
  }
  if (!visible) return null;
  const participant = viewer.id === r.customerId || viewer.id === studentId;
  const canWrite = participant && !s.deletedAt && (isMaker
    ? c!.status !== 'completed' || (c!.completedAt?.getTime() ?? 0) > Date.now() - 1000 * 60 * 60 * 24 * 60
    : r.status === 'open' && (viewer.id === r.customerId || !!q || openForStudent));
  return { request: r, student: s, quote: q ?? null, commission: isMaker ? c : null, canWrite };
}

/** Can this student see this request (feed, quoted, in conversation, or making it)? */
export async function studentCanSeeRequest(db: DB, studentId: string, requestId: string) {
  return !!(await threadAccess(db, { id: studentId, role: 'student' }, requestId, studentId));
}
