import { and, asc, desc, eq, inArray, isNull, lt, notExists, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { commission, DELIVERY, GARMENTS, HANDOVER, quote, request, requestPass, studentProfile, user } from '@/lib/db/schema';
import { fail, forbidden, notFound } from '@/lib/errors';
import { parseEuros } from '@/lib/money';
import { rateLimit } from '@/lib/ratelimit';
import { studentCanSeeRequest, visibleInFeed } from './access';
import { deliver, type Notice } from './notify';
import { attachPhotos, photosFor, PHOTO_LIMITS } from './photos';
import { readiness, shortName } from './students';
import type { Actor } from './types';

const optionalDate = z.union([z.literal(''), z.null(), z.iso.date()]).optional().transform((v) => v || null);

export const requestInput = z.object({
  garment: z.enum(GARMENTS),
  purpose: z.string().trim().max(60).default(''),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000),
  measurements: z.record(z.string().regex(/^[a-z_]{1,24}$/), z.union([z.number(), z.string()])).default({}),
  measureInPerson: z.boolean().default(false),
  fabric: z.enum(['own', 'source']).default('source'),
  budget: z.union([z.string(), z.number(), z.null()]).optional(),
  neededBy: optionalDate,
  delivery: z.enum(DELIVERY).default('either'),
  city: z.string().trim().max(60).default(''),
  targetSlug: z.string().max(80).nullish(),
  photoIds: z.array(z.uuid()).max(PHOTO_LIMITS.request).default([])
});

function cleanMeasurements(raw: Record<string, number | string>) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === '' || v === null) continue;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 300) fail('invalidMeasurement', 400, { field: k });
    out[k] = Math.round(n * 10) / 10;
  }
  return out;
}

export async function createRequest(actor: Actor, input: z.input<typeof requestInput>) {
  if (actor.role !== 'customer') forbidden();
  const v = requestInput.parse(input);
  await rateLimit(`request:${actor.id}`, 10, 24 * 60 * 60);
  const measurements = cleanMeasurements(v.measurements);
  if (!v.measureInPerson && Object.keys(measurements).length < 2) fail('measurementsRequired');
  if (v.delivery === 'in_person' && !v.city) fail('cityRequired');
  if (v.neededBy && v.neededBy < new Date().toISOString().slice(0, 10)) fail('dateInPast');
  const budgetCents = v.budget === null || v.budget === undefined || v.budget === '' ? null : parseEuros(v.budget);
  if (Number.isNaN(budgetCents)) fail('invalidAmount');
  const db = await getDb();
  let targetId: string | null = null;
  if (v.targetSlug) {
    const [t] = await db.select({ id: studentProfile.userId, accepting: studentProfile.accepting, payouts: studentProfile.payoutsEnabled, name: user.name })
      .from(studentProfile).innerJoin(user, eq(user.id, studentProfile.userId))
      .where(and(eq(studentProfile.slug, v.targetSlug), isNull(user.deletedAt), isNull(user.suspendedAt)));
    if (!t) fail('makerNotFound');
    if (!t!.accepting || !t!.payouts) fail('makerNotAccepting', 409, { name: t!.name });
    targetId = t!.id;
  }
  const id = await db.transaction(async (tx) => {
    const [r] = await tx.insert(request).values({
      customerId: actor.id, garment: v.garment, purpose: v.purpose, title: v.title, description: v.description, measurements,
      measureInPerson: v.measureInPerson, fabric: v.fabric, budgetCents, neededBy: v.neededBy, delivery: v.delivery, city: v.city, targetStudentId: targetId
    }).returning({ id: request.id });
    await attachPhotos(tx, actor.id, v.photoIds, { requestId: r.id }, PHOTO_LIMITS.request);
    return r.id;
  });
  // Notify: the chosen maker by email, or matching makers in-app.
  const notices: Notice[] = [];
  if (targetId) notices.push({ userId: targetId, type: 'newDirectRequest', values: { title: v.title, customer: shortName(actor.name) }, path: '/studio', email: 'newRequest' });
  else {
    const makers = await db.select({ id: studentProfile.userId }).from(studentProfile).innerJoin(user, eq(user.id, studentProfile.userId))
      .where(and(sql`${v.garment} = any(${studentProfile.specialities})`, eq(studentProfile.accepting, true), eq(studentProfile.payoutsEnabled, true), isNull(user.deletedAt), isNull(user.suspendedAt)))
      .limit(200);
    for (const m of makers) notices.push({ userId: m.id, type: 'newRequest', values: { title: v.title }, path: '/studio' });
  }
  await deliver(notices);
  return id;
}

/** A customer's own request with quotes, commission and photos. */
export async function getCustomerRequest(actor: Actor, id: string) {
  const db = await getDb();
  const [r] = await db.select().from(request).where(eq(request.id, id));
  if (!r || (r.customerId !== actor.id && actor.role !== 'admin')) notFound();
  const quotes = await db.select({
    q: quote, studentName: user.name, slug: studentProfile.slug, programme: studentProfile.programme, school: studentProfile.school, year: studentProfile.year,
    verified: sql<boolean>`${studentProfile.verification} = 'verified'`
  }).from(quote).innerJoin(user, eq(user.id, quote.studentId)).innerJoin(studentProfile, eq(studentProfile.userId, quote.studentId))
    .where(eq(quote.requestId, id)).orderBy(desc(sql`${quote.status} = 'accepted'`), asc(sql`${quote.labourCents} + ${quote.fabricCents} + ${quote.shippingCents}`));
  const commissions = await db.select().from(commission).where(eq(commission.requestId, id));
  const live = commissions.find((c) => c.status !== 'cancelled') ?? null;
  let target: { name: string; slug: string } | null = null;
  if (r!.targetStudentId) {
    const [t] = await db.select({ name: user.name, slug: studentProfile.slug }).from(user).innerJoin(studentProfile, eq(studentProfile.userId, user.id)).where(eq(user.id, r!.targetStudentId));
    target = t ?? null;
  }
  const photos = (await photosFor(db, 'requestId', [id])).get(id) ?? [];
  return {
    request: r!, photos, target, commission: live,
    quotes: quotes.map(({ q, ...s }) => ({ ...q, totalCents: q.labourCents + q.fabricCents + q.shippingCents, student: { id: q.studentId, name: s.studentName, slug: s.slug, programme: s.programme, school: s.school, year: s.year, verified: s.verified } }))
  };
}

export async function listCustomerRequests(actor: Actor) {
  const db = await getDb();
  const rows = await db.select().from(request).where(eq(request.customerId, actor.id)).orderBy(desc(request.createdAt));
  const ids = rows.map((r) => r.id);
  const quotes = ids.length ? await db.select({ requestId: quote.requestId, status: quote.status }).from(quote).where(inArray(quote.requestId, ids)) : [];
  const comms = ids.length ? await db.select({ c: commission, maker: user.name }).from(commission).innerJoin(user, eq(user.id, commission.studentId))
    .where(and(inArray(commission.requestId, ids), sql`${commission.status} <> 'cancelled'`)) : [];
  return rows.map((r) => ({
    ...r,
    pendingQuotes: quotes.filter((q) => q.requestId === r.id && q.status === 'pending').length,
    commission: comms.find((c) => c.c.requestId === r.id) ?? null
  }));
}

/** The request as a student sees it: customer shown as "First L.", city only. */
export async function getRequestForStudent(actor: Actor, id: string) {
  const db = await getDb();
  if (actor.role !== 'student' || !(await studentCanSeeRequest(db, actor.id, id))) notFound();
  const [row] = await db.select({ r: request, customer: user.name }).from(request).innerJoin(user, eq(user.id, request.customerId)).where(eq(request.id, id));
  const [mine] = await db.select().from(quote).where(and(eq(quote.requestId, id), eq(quote.studentId, actor.id)));
  const photos = (await photosFor(db, 'requestId', [id])).get(id) ?? [];
  return { request: { ...row.r, customer: shortName(row.customer) }, photos, myQuote: mine ?? null };
}

export async function cancelRequest(actor: Actor, id: string) {
  const db = await getDb();
  const [r] = await db.select().from(request).where(and(eq(request.id, id), eq(request.customerId, actor.id)));
  if (!r) notFound();
  if (r!.status !== 'open') fail('requestNotOpen', 409);
  const pending = await db.select().from(commission).where(and(eq(commission.requestId, id), eq(commission.status, 'pending_payment')));
  if (pending.length) fail('paymentInProgress', 409);
  const declined = await db.transaction(async (tx) => {
    await tx.update(request).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(request.id, id));
    return tx.update(quote).set({ status: 'declined' }).where(and(eq(quote.requestId, id), eq(quote.status, 'pending'))).returning({ studentId: quote.studentId });
  });
  await deliver(declined.map((q) => ({ userId: q.studentId, type: 'requestCancelled', values: { title: r!.title }, path: '/studio' })));
}

/** Open requests a student can quote on: matching garments or sent to them, not yet quoted or passed. */
export async function studentFeed(actor: Actor) {
  if (actor.role !== 'student') forbidden();
  const db = await getDb();
  const [p] = await db.select().from(studentProfile).where(eq(studentProfile.userId, actor.id));
  const rows = await db.select({ r: request, customer: user.name }).from(request).innerJoin(user, eq(user.id, request.customerId))
    .where(and(
      eq(request.status, 'open'),
      or(eq(request.targetStudentId, actor.id), and(isNull(request.targetStudentId), p.specialities.length ? inArray(request.garment, p.specialities as (typeof GARMENTS)[number][]) : sql`false`)),
      notExists(db.select().from(quote).where(and(eq(quote.requestId, request.id), eq(quote.studentId, actor.id)))),
      notExists(db.select().from(requestPass).where(and(eq(requestPass.requestId, request.id), eq(requestPass.studentId, actor.id))))
    ))
    .orderBy(desc(sql`${request.targetStudentId} = ${actor.id}`), desc(request.createdAt)).limit(100);
  const photos = await photosFor(db, 'requestId', rows.map((x) => x.r.id));
  return rows.filter(({ r }) => visibleInFeed(r, actor.id, p.specialities))
    .map(({ r, customer }) => ({ ...r, customer: shortName(customer), direct: r.targetStudentId === actor.id, photos: photos.get(r.id) ?? [] }));
}

export async function passRequest(actor: Actor, id: string) {
  if (actor.role !== 'student') forbidden();
  const db = await getDb();
  await db.insert(requestPass).values({ studentId: actor.id, requestId: id }).onConflictDoNothing();
}

// ─────────────── quotes ───────────────

export const quoteInput = z.object({
  labour: z.union([z.string(), z.number()]),
  fabric: z.union([z.string(), z.number()]).optional(),
  shipping: z.union([z.string(), z.number()]).optional(),
  handover: z.enum(HANDOVER),
  alteration: z.boolean().default(false),
  readyBy: optionalDate,
  message: z.string().trim().max(2000).default('')
});

export async function createQuote(actor: Actor, requestId: string, input: z.input<typeof quoteInput>) {
  if (actor.role !== 'student') forbidden();
  const v = quoteInput.parse(input);
  const db = await getDb();
  const ready = await readiness(db, actor.id);
  if (!ready.ready) fail('notReadyToQuote', 409);
  const [p] = await db.select({ accepting: studentProfile.accepting, specialities: studentProfile.specialities }).from(studentProfile).where(eq(studentProfile.userId, actor.id));
  if (!p.accepting) fail('pausedCannotQuote', 409);
  const [r] = await db.select().from(request).where(eq(request.id, requestId));
  if (!r || !visibleInFeed(r, actor.id, p.specialities)) fail('requestNotOpen', 404);
  if (r!.delivery !== 'either' && r!.delivery !== v.handover) fail(r!.delivery === 'shipping' ? 'customerWantsShipping' : 'customerWantsInPerson');
  const labourCents = parseEuros(v.labour);
  const fabricCents = r!.fabric === 'own' ? 0 : parseEuros(v.fabric ?? '') ?? 0;
  const shippingCents = v.handover === 'shipping' ? parseEuros(v.shipping ?? '') ?? 0 : 0;
  if (!labourCents || Number.isNaN(labourCents) || labourCents < 500 || Number.isNaN(fabricCents) || Number.isNaN(shippingCents)) fail('invalidAmount');
  if (v.readyBy && v.readyBy < new Date().toISOString().slice(0, 10)) fail('dateInPast');
  await rateLimit(`quote:${actor.id}`, 30, 24 * 60 * 60);
  const [q] = await db.insert(quote).values({
    requestId, studentId: actor.id, labourCents: labourCents!, fabricCents, shippingCents, handover: v.handover, alteration: v.alteration, readyBy: v.readyBy, message: v.message
  }).onConflictDoNothing().returning();
  if (!q) fail('alreadyQuoted', 409);
  const total = labourCents! + fabricCents + shippingCents;
  await deliver([{ userId: r!.customerId, type: 'newQuote', values: { maker: actor.name, title: r!.title, total }, path: `/requests/${requestId}`, email: 'newQuote' }]);
  return q!.id;
}

export async function withdrawQuote(actor: Actor, quoteId: string) {
  const db = await getDb();
  // A customer may be on the payment page for this quote right now.
  const busy = await db.select().from(commission).where(and(eq(commission.quoteId, quoteId), eq(commission.status, 'pending_payment')));
  if (busy.length) fail('paymentInProgress', 409);
  const [q] = await db.update(quote).set({ status: 'withdrawn' }).where(and(eq(quote.id, quoteId), eq(quote.studentId, actor.id), eq(quote.status, 'pending'))).returning();
  if (!q) fail('quoteNotAvailable', 409);
}

export async function studentQuotes(actor: Actor) {
  const db = await getDb();
  const rows = await db.select({ q: quote, title: request.title, garment: request.garment, requestStatus: request.status, customer: user.name })
    .from(quote).innerJoin(request, eq(request.id, quote.requestId)).innerJoin(user, eq(user.id, request.customerId))
    .where(and(eq(quote.studentId, actor.id), sql`${quote.status} <> 'accepted'`)).orderBy(desc(quote.createdAt)).limit(50);
  return rows.map(({ q, ...rest }) => ({ ...q, ...rest, customer: shortName(rest.customer), totalCents: q.labourCents + q.fabricCents + q.shippingCents }));
}

/** Cron: open requests past their date (or 60 days old) expire, and their quotes are closed. */
export async function expireOldRequests() {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const expired = await db.update(request).set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(request.status, 'open'), or(lt(request.neededBy, today), lt(request.createdAt, cutoff)),
      notExists(db.select().from(commission).where(and(eq(commission.requestId, request.id), eq(commission.status, 'pending_payment'))))))
    .returning({ id: request.id });
  if (expired.length) await db.update(quote).set({ status: 'declined' }).where(and(inArray(quote.requestId, expired.map((e) => e.id)), eq(quote.status, 'pending')));
  return expired.length;
}
