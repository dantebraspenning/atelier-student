import { and, avg, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type DB } from '@/lib/db';
import { commission, GARMENTS, photo, portfolioPiece, review, studentProfile, studentVerification, taxDetails, user } from '@/lib/db/schema';
import { decrypt, encrypt, randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { fail, forbidden, notFound } from '@/lib/errors';
import { sendEmail } from '@/lib/email';
import { parseEuros } from '@/lib/money';
import { payments } from '@/lib/payments';
import { rateLimit } from '@/lib/ratelimit';
import { alertAdmins, deliver } from './notify';
import { attachPhotos, photoRef, photosFor, PHOTO_LIMITS, type PhotoRef } from './photos';
import type { Actor } from './types';

export type Maker = Awaited<ReturnType<typeof listMakers>>[number];

const makerSelect = {
  id: user.id, name: user.name, slug: studentProfile.slug, programme: studentProfile.programme, school: studentProfile.school,
  year: studentProfile.year, city: studentProfile.city, bio: studentProfile.bio, specialities: studentProfile.specialities,
  skills: studentProfile.skills, turnaround: studentProfile.turnaround, accepting: studentProfile.accepting, rates: studentProfile.rates,
  verified: sql<boolean>`${studentProfile.verification} = 'verified'`,
  payoutsEnabled: studentProfile.payoutsEnabled
};

type Stats = { delivered: number; reviews: number; rating: number | null; pieces: number };

async function enrich(db: DB, rows: { id: string }[]): Promise<{ stats: Map<string, Stats>; covers: Map<string, PhotoRef> }> {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { stats: new Map(), covers: new Map() };
  const delivered = await db.select({ id: commission.studentId, n: count() }).from(commission)
    .where(and(inArray(commission.studentId, ids), eq(commission.status, 'completed'))).groupBy(commission.studentId);
  const reviews = await db.select({ id: review.studentId, n: count(), avg: avg(review.rating) }).from(review)
    .where(and(inArray(review.studentId, ids), isNull(review.hiddenAt))).groupBy(review.studentId);
  const pieces = await db.select({ id: portfolioPiece.studentId, n: count() }).from(portfolioPiece)
    .where(and(inArray(portfolioPiece.studentId, ids), isNull(portfolioPiece.hiddenAt))).groupBy(portfolioPiece.studentId);
  // newest visible portfolio photo per student = card image
  const coverRows = await db.selectDistinctOn([portfolioPiece.studentId], { studentId: portfolioPiece.studentId, id: photo.id, width: photo.width, height: photo.height })
    .from(photo).innerJoin(portfolioPiece, eq(photo.portfolioId, portfolioPiece.id))
    .where(and(inArray(portfolioPiece.studentId, ids), isNull(photo.hiddenAt), isNull(portfolioPiece.hiddenAt)))
    .orderBy(portfolioPiece.studentId, desc(portfolioPiece.createdAt), photo.position);
  const stats = new Map<string, Stats>();
  for (const id of ids) stats.set(id, { delivered: 0, reviews: 0, rating: null, pieces: 0 });
  for (const d of delivered) stats.get(d.id)!.delivered = Number(d.n);
  for (const r of reviews) Object.assign(stats.get(r.id)!, { reviews: Number(r.n), rating: r.avg ? Math.round(Number(r.avg) * 10) / 10 : null });
  for (const p of pieces) stats.get(p.id)!.pieces = Number(p.n);
  return { stats, covers: new Map(coverRows.map((c) => [c.studentId, photoRef(c)])) };
}

const visibleMaker = and(eq(user.role, 'student'), isNull(user.deletedAt), isNull(user.suspendedAt), eq(user.emailVerified, true));

export async function listMakers(filters: { garment?: string; open?: boolean; q?: string; city?: string } = {}) {
  const db = await getDb();
  const conds = [visibleMaker, sql`cardinality(${studentProfile.specialities}) > 0`];
  if (filters.garment && (GARMENTS as readonly string[]).includes(filters.garment)) conds.push(sql`${filters.garment} = any(${studentProfile.specialities})`);
  if (filters.open) conds.push(eq(studentProfile.accepting, true), eq(studentProfile.payoutsEnabled, true));
  if (filters.city) conds.push(sql`lower(${studentProfile.city}) = lower(${filters.city.trim()})`);
  if (filters.q) {
    const like = `%${filters.q.trim().toLowerCase().slice(0, 80).replace(/[%_\\]/g, '\\$&')}%`;
    conds.push(sql`lower(${user.name} || ' ' || ${studentProfile.bio} || ' ' || ${studentProfile.programme} || ' ' || ${studentProfile.school} || ' ' || ${studentProfile.city} || ' ' || array_to_string(${studentProfile.skills}, ' ')) like ${like}`);
  }
  const rows = await db.select(makerSelect).from(user).innerJoin(studentProfile, eq(studentProfile.userId, user.id))
    .where(and(...conds)).orderBy(desc(studentProfile.accepting), desc(sql`${studentProfile.verification} = 'verified'`), user.createdAt).limit(200);
  const { stats, covers } = await enrich(db, rows);
  return rows.map((r) => ({ ...r, ...stats.get(r.id)!, cover: covers.get(r.id) ?? null }));
}

export async function getMakerBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db.select(makerSelect).from(user).innerJoin(studentProfile, eq(studentProfile.userId, user.id))
    .where(and(visibleMaker, eq(studentProfile.slug, slug)));
  if (!row) return null;
  const { stats, covers } = await enrich(db, [row]);
  const pieces = await db.select().from(portfolioPiece).where(and(eq(portfolioPiece.studentId, row.id), isNull(portfolioPiece.hiddenAt))).orderBy(desc(portfolioPiece.createdAt));
  const photos = await photosFor(db, 'portfolioId', pieces.map((p) => p.id));
  const reviews = await db.select({ id: review.id, rating: review.rating, body: review.body, reply: review.reply, createdAt: review.createdAt, customer: user.name })
    .from(review).innerJoin(user, eq(user.id, review.customerId))
    .where(and(eq(review.studentId, row.id), isNull(review.hiddenAt))).orderBy(desc(review.createdAt)).limit(50);
  return {
    maker: { ...row, ...stats.get(row.id)!, cover: covers.get(row.id) ?? null },
    portfolio: pieces.map((p) => ({ ...p, photos: photos.get(p.id) ?? [] })),
    reviews: reviews.map((r) => ({ ...r, customer: shortName(r.customer) }))
  };
}

export const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

export async function getOwnProfile(studentId: string) {
  const db = await getDb();
  const [p] = await db.select().from(studentProfile).where(eq(studentProfile.userId, studentId));
  if (!p) notFound();
  return p!;
}

// ─────────────── readiness ───────────────

export type Readiness = { profile: boolean; verified: boolean; tax: boolean; payouts: boolean; ready: boolean };

/** A student can send quotes once their profile, student status, tax details (DAC7) and payouts are in place. */
export async function readiness(db: DB, studentId: string): Promise<Readiness> {
  const [p] = await db.select().from(studentProfile).where(eq(studentProfile.userId, studentId));
  const [t] = await db.select({ userId: taxDetails.userId }).from(taxDetails).where(eq(taxDetails.userId, studentId));
  const r = {
    profile: !!p && p.specialities.length > 0 && p.city.trim().length > 0,
    verified: p?.verification === 'verified',
    tax: !!t,
    payouts: !!p?.payoutsEnabled
  };
  return { ...r, ready: r.profile && r.verified && r.tax && r.payouts };
}

// ─────────────── profile ───────────────

const rateSchema = z.object({ label: z.string().trim().min(1).max(40), from: z.union([z.string(), z.number()]) });
export const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  programme: z.string().trim().max(80),
  school: z.string().trim().max(80),
  year: z.string().trim().max(30),
  city: z.string().trim().max(60),
  bio: z.string().trim().max(1200),
  turnaround: z.string().trim().max(40),
  specialities: z.array(z.enum(GARMENTS)).max(GARMENTS.length),
  skills: z.array(z.string().trim().min(1).max(40)).max(12),
  rates: z.array(rateSchema).max(8)
});

export async function updateProfile(actor: Actor, input: z.input<typeof profileInput>) {
  if (actor.role !== 'student') forbidden();
  const v = profileInput.parse(input);
  const rates = v.rates.map((r) => {
    const cents = parseEuros(r.from);
    if (cents === null || Number.isNaN(cents) || cents <= 0) fail('invalidAmount');
    return { label: r.label, fromCents: cents! };
  });
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(studentProfile).set({
      programme: v.programme, school: v.school, year: v.year, city: v.city, bio: v.bio, turnaround: v.turnaround,
      specialities: [...new Set(v.specialities)], skills: [...new Set(v.skills)], rates
    }).where(eq(studentProfile.userId, actor.id));
    await tx.update(user).set({ name: v.name, updatedAt: new Date() }).where(eq(user.id, actor.id));
  });
}

export async function setAccepting(actor: Actor, accepting: boolean) {
  if (actor.role !== 'student') forbidden();
  const db = await getDb();
  await db.update(studentProfile).set({ accepting }).where(eq(studentProfile.userId, actor.id));
}

// ─────────────── student verification ───────────────

export function schoolDomainAllowed(email: string) {
  const domain = email.toLowerCase().split('@')[1] ?? '';
  return env().SCHOOL_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Option 1: prove you have a school email address on an approved domain. */
export async function startSchoolEmailVerification(actor: Actor, schoolEmail: string) {
  if (actor.role !== 'student') forbidden();
  const email = z.email().parse(schoolEmail.trim().toLowerCase());
  if (!schoolDomainAllowed(email)) fail('schoolDomainNotAllowed');
  await rateLimit(`school-email:${actor.id}`, 5, 60 * 60);
  const token = randomToken();
  const db = await getDb();
  await db.insert(studentVerification).values({
    userId: actor.id, method: 'school_email', schoolEmail: email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
  await db.update(studentProfile).set({ verification: 'pending' }).where(and(eq(studentProfile.userId, actor.id), sql`${studentProfile.verification} <> 'verified'`));
  await sendEmail({ to: email, template: 'schoolEmail', locale: actor.locale, values: { name: actor.name.split(' ')[0] }, url: `/${actor.locale}/studio/verify?token=${token}` });
}

export async function confirmSchoolEmail(actor: Actor, token: string) {
  const db = await getDb();
  const [v] = await db.select().from(studentVerification)
    .where(and(eq(studentVerification.userId, actor.id), eq(studentVerification.tokenHash, sha256(token)), eq(studentVerification.status, 'pending')));
  if (!v || !v.expiresAt || v.expiresAt < new Date()) fail('invalidOrExpiredLink');
  await db.transaction(async (tx) => {
    await tx.update(studentVerification).set({ status: 'approved', reviewedAt: new Date(), tokenHash: null }).where(eq(studentVerification.id, v!.id));
    await tx.update(studentProfile).set({ verification: 'verified', verifiedAt: new Date() }).where(eq(studentProfile.userId, actor.id));
  });
}

/** Option 2: upload a photo of a student card / enrolment letter for manual review. */
export async function submitDocumentVerification(actor: Actor, photoIds: string[], note: string) {
  if (actor.role !== 'student') forbidden();
  if (!photoIds.length) fail('photoRequired');
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [v] = await tx.insert(studentVerification).values({ userId: actor.id, method: 'document', note: note.slice(0, 500) }).returning();
    await attachPhotos(tx, actor.id, photoIds, { verificationId: v.id }, PHOTO_LIMITS.verification);
    await tx.update(studentProfile).set({ verification: 'pending' }).where(and(eq(studentProfile.userId, actor.id), sql`${studentProfile.verification} <> 'verified'`));
  });
  await alertAdmins('Student verification to review', `${actor.name} uploaded a student document.`, '/admin/verifications');
}

export async function reviewVerification(admin: Actor, verificationId: string, approve: boolean, note = '') {
  if (admin.role !== 'admin') forbidden();
  const db = await getDb();
  const [v] = await db.select().from(studentVerification).where(eq(studentVerification.id, verificationId));
  if (!v || v.status !== 'pending') notFound();
  await db.transaction(async (tx) => {
    await tx.update(studentVerification).set({ status: approve ? 'approved' : 'rejected', reviewedBy: admin.id, reviewedAt: new Date(), note: note.slice(0, 500) })
      .where(eq(studentVerification.id, verificationId));
    await tx.update(studentProfile).set(approve ? { verification: 'verified', verifiedAt: new Date() } : { verification: 'rejected' })
      .where(eq(studentProfile.userId, v!.userId));
  });
  await deliver([{ userId: v!.userId, type: approve ? 'studentVerified' : 'studentRejected', values: { note }, path: '/studio/setup', email: approve ? 'studentVerified' : 'studentRejected' }]);
}

// ─────────────── tax details (DAC7) ───────────────

export const taxInput = z.object({
  legalName: z.string().trim().min(2).max(120),
  dateOfBirth: z.iso.date(),
  addressLine: z.string().trim().min(3).max(160),
  postalCode: z.string().trim().min(3).max(12),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().length(2).toUpperCase().default('NL'),
  tin: z.string().trim().min(5).max(30)
});

/** Dutch BSN check (elfproef) when the country is NL. */
export function validBsn(bsn: string) {
  const d = bsn.replace(/\D/g, '');
  if (d.length !== 9 && d.length !== 8) return false;
  const digits = d.padStart(9, '0').split('').map(Number);
  const sum = digits.slice(0, 8).reduce((s, n, i) => s + n * (9 - i), 0) - digits[8];
  return sum % 11 === 0 && sum !== 0;
}

export async function saveTaxDetails(actor: Actor, input: z.input<typeof taxInput>) {
  if (actor.role !== 'student') forbidden();
  const v = taxInput.parse(input);
  if (v.country === 'NL' && !validBsn(v.tin)) fail('invalidBsn');
  const age = (Date.now() - new Date(v.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 16 || age > 100) fail('invalidDateOfBirth');
  const db = await getDb();
  const row = { legalName: v.legalName, dateOfBirth: v.dateOfBirth, addressLine: v.addressLine, postalCode: v.postalCode.toUpperCase(), city: v.city, country: v.country, tinEncrypted: encrypt(v.tin.replace(/\s/g, '')), updatedAt: new Date() };
  await db.insert(taxDetails).values({ userId: actor.id, ...row }).onConflictDoUpdate({ target: taxDetails.userId, set: row });
}

export async function getTaxDetails(actor: Actor) {
  const db = await getDb();
  const [t] = await db.select().from(taxDetails).where(eq(taxDetails.userId, actor.id));
  if (!t) return null;
  const tin = decrypt(t.tinEncrypted);
  return { ...t, tinEncrypted: undefined, tinMasked: `•••••${tin.slice(-3)}` };
}

// ─────────────── payouts (Stripe Connect) ───────────────

export async function startPayoutOnboarding(actor: Actor) {
  if (actor.role !== 'student') forbidden();
  const db = await getDb();
  const p = await getOwnProfile(actor.id);
  let accountId = p.stripeAccountId;
  if (!accountId) {
    accountId = await payments().createConnectAccount({ userId: actor.id, email: actor.email });
    await db.update(studentProfile).set({ stripeAccountId: accountId }).where(eq(studentProfile.userId, actor.id));
  }
  const base = `${env().APP_URL}/${actor.locale}/studio/setup`;
  return payments().onboardingLink({ accountId, returnUrl: `${base}?payouts=return`, refreshUrl: `${base}?payouts=refresh` });
}

/** Refresh payout status from the provider (on return from onboarding, and from the `account.updated` webhook). */
export async function syncPayoutStatus(studentIdOrAccount: { userId?: string; accountId?: string }) {
  const db = await getDb();
  const [p] = await db.select().from(studentProfile).where(studentIdOrAccount.userId
    ? eq(studentProfile.userId, studentIdOrAccount.userId) : eq(studentProfile.stripeAccountId, studentIdOrAccount.accountId!));
  if (!p?.stripeAccountId) return null;
  const status = await payments().accountStatus(p.stripeAccountId);
  await db.update(studentProfile).set({ payoutsEnabled: status.payoutsEnabled }).where(eq(studentProfile.userId, p.userId));
  return status;
}

export async function payoutDashboardLink(actor: Actor) {
  const p = await getOwnProfile(actor.id);
  if (!p.stripeAccountId) fail('payoutsNotSetUp');
  return payments().dashboardLink(p.stripeAccountId!);
}
