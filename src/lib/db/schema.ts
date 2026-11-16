import { sql } from 'drizzle-orm';
import {
  bigint, bigserial, boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid
} from 'drizzle-orm/pg-core';

// All money is stored as integer euro cents.

import { GARMENTS, type Garment, type Rate } from '@/lib/constants';
export { GARMENTS, type Garment, type Rate };
export const ROLES = ['customer', 'student', 'admin'] as const;
export type Role = (typeof ROLES)[number];
export const DELIVERY = ['either', 'in_person', 'shipping'] as const;
export const HANDOVER = ['in_person', 'shipping'] as const;
export type Handover = (typeof HANDOVER)[number];
export const COMMISSION_STATUS = ['pending_payment', 'making', 'sent', 'altering', 'disputed', 'completed', 'cancelled'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUS)[number];
export const PAYMENT_STATUS = ['unpaid', 'held', 'released', 'refunded', 'partially_refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => ts('created_at').notNull().defaultNow();

// ─────────────────────────── Auth (managed by Better Auth) ───────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  // app fields
  role: text('role', { enum: ROLES }).notNull().default('customer'),
  locale: text('locale', { enum: ['nl', 'en'] }).notNull().default('nl'),
  notifyMessages: boolean('notify_messages').notNull().default(true),
  suspendedAt: ts('suspended_at'),
  deletedAt: ts('deleted_at')
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: ts('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
}, (t) => [index('session_user_idx').on(t.userId)]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: ts('access_token_expires_at'),
  refreshTokenExpiresAt: ts('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow()
}, (t) => [index('account_user_idx').on(t.userId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow()
}, (t) => [index('verification_identifier_idx').on(t.identifier)]);

export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull()
});

// ─────────────────────────── Students ───────────────────────────


export const studentProfile = pgTable('student_profile', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  programme: text('programme').notNull().default(''),
  school: text('school').notNull().default(''),
  year: text('year').notNull().default(''),
  city: text('city').notNull().default(''),
  bio: text('bio').notNull().default(''),
  specialities: text('specialities').array().$type<Garment[]>().notNull().default(sql`'{}'::text[]`),
  skills: text('skills').array().notNull().default(sql`'{}'::text[]`),
  turnaround: text('turnaround').notNull().default(''),
  accepting: boolean('accepting').notNull().default(true),
  rates: jsonb('rates').$type<Rate[]>().notNull().default([]),
  verification: text('verification', { enum: ['unverified', 'pending', 'verified', 'rejected'] }).notNull().default('unverified'),
  verifiedAt: ts('verified_at'),
  stripeAccountId: text('stripe_account_id'),
  payoutsEnabled: boolean('payouts_enabled').notNull().default(false),
  createdAt: created()
});

/** DAC7: platforms must report what sellers earn. TIN is encrypted at rest. */
export const taxDetails = pgTable('tax_details', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  legalName: text('legal_name').notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  addressLine: text('address_line').notNull(),
  postalCode: text('postal_code').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull().default('NL'),
  tinEncrypted: text('tin_encrypted').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow()
});

export const studentVerification = pgTable('student_verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  method: text('method', { enum: ['school_email', 'document'] }).notNull(),
  schoolEmail: text('school_email'),
  tokenHash: text('token_hash'),
  expiresAt: ts('expires_at'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  reviewedBy: text('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
  reviewedAt: ts('reviewed_at'),
  note: text('note').notNull().default(''),
  createdAt: created()
}, (t) => [index('student_verification_user_idx').on(t.userId)]);

// ─────────────────────────── Requests & quotes ───────────────────────────

export const request = pgTable('request', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: text('customer_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  garment: text('garment', { enum: GARMENTS }).notNull(),
  purpose: text('purpose').notNull().default(''),
  title: text('title').notNull(),
  description: text('description').notNull(),
  measurements: jsonb('measurements').$type<Record<string, number>>().notNull().default({}),
  measureInPerson: boolean('measure_in_person').notNull().default(false),
  fabric: text('fabric', { enum: ['own', 'source'] }).notNull().default('source'),
  budgetCents: integer('budget_cents'),
  neededBy: date('needed_by'),
  delivery: text('delivery', { enum: DELIVERY }).notNull().default('either'),
  city: text('city').notNull().default(''),
  targetStudentId: text('target_student_id').references(() => user.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['open', 'accepted', 'cancelled', 'expired'] }).notNull().default('open'),
  createdAt: created(),
  updatedAt: ts('updated_at').notNull().defaultNow()
}, (t) => [index('request_customer_idx').on(t.customerId), index('request_status_idx').on(t.status, t.garment)]);

export const quote = pgTable('quote', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => request.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  labourCents: integer('labour_cents').notNull(),
  fabricCents: integer('fabric_cents').notNull().default(0),
  shippingCents: integer('shipping_cents').notNull().default(0),
  handover: text('handover', { enum: HANDOVER }).notNull(),
  alteration: boolean('alteration').notNull().default(false),
  readyBy: date('ready_by'),
  message: text('message').notNull().default(''),
  status: text('status', { enum: ['pending', 'accepted', 'declined', 'withdrawn'] }).notNull().default('pending'),
  createdAt: created()
}, (t) => [uniqueIndex('quote_request_student_uq').on(t.requestId, t.studentId), check('quote_amounts', sql`${t.labourCents} > 0 and ${t.fabricCents} >= 0 and ${t.shippingCents} >= 0`)]);

export const requestPass = pgTable('request_pass', {
  studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull().references(() => request.id, { onDelete: 'cascade' })
}, (t) => [primaryKey({ columns: [t.studentId, t.requestId] })]);

// ─────────────────────────── Commissions & money ───────────────────────────

export const commission = pgTable('commission', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => request.id, { onDelete: 'restrict' }),
  quoteId: uuid('quote_id').notNull().references(() => quote.id, { onDelete: 'restrict' }),
  studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  customerId: text('customer_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  totalCents: integer('total_cents').notNull(),
  feeCents: integer('fee_cents').notNull(),
  handover: text('handover', { enum: HANDOVER }).notNull(),
  status: text('status', { enum: COMMISSION_STATUS }).notNull().default('pending_payment'),
  paymentStatus: text('payment_status', { enum: PAYMENT_STATUS }).notNull().default('unpaid'),
  alterationIncluded: boolean('alteration_included').notNull().default(false),
  alterationUsed: boolean('alteration_used').notNull().default(false),
  alterationNote: text('alteration_note').notNull().default(''),
  trackingUrl: text('tracking_url'),
  sentAt: ts('sent_at'),
  reminderSentAt: ts('reminder_sent_at'),
  completedAt: ts('completed_at'),
  completedBy: text('completed_by', { enum: ['customer', 'auto', 'admin'] }),
  cancelledAt: ts('cancelled_at'),
  cancelReason: text('cancel_reason').notNull().default(''),
  // mutual cancellation proposal while the piece is being made
  cancelProposedBy: text('cancel_proposed_by').references(() => user.id, { onDelete: 'set null' }),
  cancelRefundCents: integer('cancel_refund_cents'),
  cancelProposedAt: ts('cancel_proposed_at'),
  // payment provider references
  checkoutSessionId: text('checkout_session_id'),
  paymentIntentId: text('payment_intent_id'),
  chargeId: text('charge_id'),
  transferId: text('transfer_id'),
  paidAt: ts('paid_at'),
  refundedCents: integer('refunded_cents').notNull().default(0),
  releasedCents: integer('released_cents').notNull().default(0),
  inPortfolio: boolean('in_portfolio').notNull().default(false),
  createdAt: created(),
  updatedAt: ts('updated_at').notNull().defaultNow()
}, (t) => [
  // one live commission per request; abandoned checkouts are 'cancelled'
  uniqueIndex('commission_request_live_uq').on(t.requestId).where(sql`${t.status} <> 'cancelled'`),
  index('commission_student_idx').on(t.studentId),
  index('commission_customer_idx').on(t.customerId),
  index('commission_status_idx').on(t.status)
]);

export const dispute = pgTable('dispute', {
  id: uuid('id').primaryKey().defaultRandom(),
  commissionId: uuid('commission_id').notNull().references(() => commission.id, { onDelete: 'cascade' }),
  openedBy: text('opened_by').notNull().references(() => user.id, { onDelete: 'restrict' }),
  reason: text('reason', { enum: ['not_received', 'not_as_agreed', 'poor_quality', 'damaged', 'other'] }).notNull(),
  details: text('details').notNull(),
  status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
  resolution: text('resolution', { enum: ['release', 'refund', 'split'] }),
  refundCents: integer('refund_cents'),
  resolvedBy: text('resolved_by').references(() => user.id, { onDelete: 'set null' }),
  resolvedAt: ts('resolved_at'),
  note: text('note').notNull().default(''),
  createdAt: created()
}, (t) => [index('dispute_status_idx').on(t.status)]);

export const review = pgTable('review', {
  id: uuid('id').primaryKey().defaultRandom(),
  commissionId: uuid('commission_id').notNull().unique().references(() => commission.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  body: text('body').notNull().default(''),
  reply: text('reply'),
  repliedAt: ts('replied_at'),
  hiddenAt: ts('hidden_at'),
  createdAt: created()
}, (t) => [index('review_student_idx').on(t.studentId), check('review_rating', sql`${t.rating} between 1 and 5`)]);

/** Stripe webhook idempotency. */
export const paymentEvent = pgTable('payment_event', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: ts('processed_at').notNull().defaultNow()
});

// ─────────────────────────── Portfolio & photos ───────────────────────────

export const portfolioPiece = pgTable('portfolio_piece', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  garment: text('garment', { enum: GARMENTS }).notNull(),
  material: text('material').notNull().default(''),
  kind: text('kind', { enum: ['commission', 'coursework'] }).notNull().default('coursework'),
  story: text('story').notNull().default(''),
  commissionId: uuid('commission_id').references(() => commission.id, { onDelete: 'set null' }),
  hiddenAt: ts('hidden_at'),
  createdAt: created()
}, (t) => [index('portfolio_student_idx').on(t.studentId)]);

export const photo = pgTable('photo', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull().unique(),
  thumbKey: text('thumb_key').notNull().unique(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  requestId: uuid('request_id').references(() => request.id, { onDelete: 'cascade' }),
  portfolioId: uuid('portfolio_id').references(() => portfolioPiece.id, { onDelete: 'cascade' }),
  messageId: bigint('message_id', { mode: 'number' }).references(() => message.id, { onDelete: 'cascade' }),
  verificationId: uuid('verification_id').references(() => studentVerification.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  hiddenAt: ts('hidden_at'),
  createdAt: created()
}, (t) => [
  index('photo_request_idx').on(t.requestId),
  index('photo_portfolio_idx').on(t.portfolioId),
  index('photo_message_idx').on(t.messageId),
  index('photo_owner_idx').on(t.ownerId)
]);

// ─────────────────────────── Messaging & notifications ───────────────────────────

/** One thread per (request, student). The customer is the request's owner. */
export const message = pgTable('message', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  requestId: uuid('request_id').notNull().references(() => request.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').references(() => user.id, { onDelete: 'set null' }),
  body: text('body').notNull().default(''),
  kind: text('kind', { enum: ['text', 'event'] }).notNull().default('text'),
  /** For events: translation key + values, rendered in each reader's language. */
  event: jsonb('event').$type<{ key: string; values?: Record<string, string | number> }>(),
  hiddenAt: ts('hidden_at'),
  createdAt: created()
}, (t) => [index('message_thread_idx').on(t.requestId, t.studentId, t.id)]);

export const threadRead = pgTable('thread_read', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull().references(() => request.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  lastReadId: bigint('last_read_id', { mode: 'number' }).notNull().default(0),
  lastEmailedAt: ts('last_emailed_at')
}, (t) => [primaryKey({ columns: [t.userId, t.requestId, t.studentId] })]);

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  values: jsonb('values').$type<Record<string, string | number>>().notNull().default({}),
  href: text('href').notNull(),
  readAt: ts('read_at'),
  createdAt: created()
}, (t) => [index('notification_user_idx').on(t.userId, t.createdAt)]);

export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: text('to').notNull(),
  template: text('template').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  status: text('status', { enum: ['logged', 'sent', 'failed'] }).notNull(),
  error: text('error'),
  createdAt: created()
}, (t) => [index('email_outbox_created_idx').on(t.createdAt)]);

// ─────────────────────────── Trust & safety ───────────────────────────

export const REPORT_TARGETS = ['user', 'message', 'photo', 'portfolio', 'review', 'request'] as const;

/** DSA notice-and-action: anyone signed in can report content or people. */
export const report = pgTable('report', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: text('reporter_id').references(() => user.id, { onDelete: 'set null' }),
  targetType: text('target_type', { enum: REPORT_TARGETS }).notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason', { enum: ['spam', 'harassment', 'inappropriate', 'scam', 'off_platform_payment', 'other'] }).notNull(),
  details: text('details').notNull().default(''),
  status: text('status', { enum: ['open', 'actioned', 'dismissed'] }).notNull().default('open'),
  handledBy: text('handled_by').references(() => user.id, { onDelete: 'set null' }),
  handledAt: ts('handled_at'),
  note: text('note').notNull().default(''),
  createdAt: created()
}, (t) => [index('report_status_idx').on(t.status)]);

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: created()
}, (t) => [index('audit_entity_idx').on(t.entityType, t.entityId)]);

/** Fixed-window rate limiting for app actions (shared across server instances). */
export const appRateLimit = pgTable('app_rate_limit', {
  key: text('key').primaryKey(),
  windowStart: ts('window_start').notNull(),
  count: integer('count').notNull()
});
