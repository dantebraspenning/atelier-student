# Atelier Student

A marketplace where **fashion students build their portfolio by making custom pieces** — and get paid for it.
Customers request made-to-measure garments, verified students send fixed quotes, the customer pays up front and the
money is **held until the piece arrives**. Completed commissions go straight into the student's public portfolio.

Dutch and English. Built for launch: the software is complete; what remains is infrastructure and accounts (see
[Going live](#going-live)).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, server components, server actions), React 19, TypeScript |
| Styling | Tailwind CSS 4 with the "Linen & thread" design tokens (`src/app/globals.css`) |
| Database | Postgres via Drizzle ORM. Locally: embedded Postgres (PGlite) — nothing to install |
| Auth | Better Auth: email + password, email verification, password reset, sessions in Postgres, rate limiting |
| Payments | Stripe Connect (separate charges & transfers, Express accounts for students, iDEAL + cards) |
| Email | Any SMTP provider (Postmark, Resend, SES, Brevo…), every mail also stored in an outbox table |
| Photos | sharp (resize, strip metadata) + local disk or any S3-compatible storage |
| i18n | next-intl, `/nl` and `/en` URLs, Dutch default |
| Tests | Vitest (domain logic on an in-memory Postgres) and Playwright (full flow in a browser) |

## Run it locally

```bash
npm install
npm run dev            # http://localhost:3000
```

No configuration needed. Without keys the app runs in **local mode**:

- **Database** — embedded Postgres in `.data/pglite`, migrated automatically on start.
- **Demo data** — 6 student makers, 2 customers and an admin are created in an empty database. Accounts and the
  shared demo password are in `src/lib/seed.ts` (development only; seeding never runs in production).
- **Payments** — simulated: “Accept & pay” opens a test checkout (`/dev/checkout/…`); payouts are fake transfers.
  A banner on every page says so.
- **Email** — not sent; read them at **`/nl/dev/mail`** (verification and reset links are clickable there).
- **Photos** — stored in `.data/uploads`.

Delete `.data/` to start over. Copy `.env.example` to `.env.local` to configure anything.

```bash
npm test               # domain tests (money flows, permissions, privacy, DAC7 …)
npm run test:e2e       # browser test of the whole commission lifecycle
npm run check          # typecheck + lint + tests
npm run db:generate    # new migration after editing src/lib/db/schema.ts
```

## What it does

**Customers** — browse and search makers (garment, availability, city, skills); public maker pages with portfolio,
rate guide, reviews and verified-student badge; a 4-step request wizard (garment-specific measurements or "measure me
in person", description, reference photos, fabric, budget, deadline, delivery: in person / shipped / either) that a
guest can fill in and send after signing up; compare quotes; **pay on acceptance** (held); follow progress; confirm
receipt (releases payment), use the included alteration round, propose a cancellation, or report a problem; review the
maker.

**Students (Studio)** — setup checklist (profile, student verification, DAC7 tax details, Stripe payouts); feed of
matching and direct requests; ask questions before quoting; quote with making/fabric/shipping, handover method,
optional alteration round and live "you receive €… after fees"; mark as shipped (with tracking link) or handed over;
cancellation proposals or a full refund if they can't finish; earnings (paid out vs. held); one-click portfolio from
completed commissions plus coursework with photos; reply to reviews; pause/resume requests.

**Messages** — one conversation per request and maker, photos, live updates, unread badges, email alerts (throttled to
one per 30 minutes per conversation, can be switched off), lifecycle events shown in each reader's language,
conversations close for makers who weren't chosen.

**Trust & safety** — verified students (school email on approved domains, or document review); report any person,
message, photo, portfolio piece, review or request (EU DSA notice-and-action); admins hide content and suspend accounts.

**Admin** (`/admin`, role via `ADMIN_EMAILS`) — overview, verification queue, disputes (release / refund / split),
reports, users (suspend), payments, **DAC7 export** (CSV per calendar year).

**Accounts** — settings, language, password change, GDPR data export (JSON), account deletion (personal data erased,
bookkeeping records kept anonymised; blocked while money is held).

### How the money works

```
accept quote ──► Stripe Checkout ──► webhook: paid ──► HELD on the platform
                                                         │
     maker marks shipped / handed over ──────────────────┤
                                                         ├─ customer confirms ─────────────► transfer to maker (minus fee)
                                                         ├─ no response in AUTO_RELEASE_DAYS ► transfer to maker (minus fee)
                                                         ├─ alteration (if included) ──► back to making, still held
                                                         ├─ mutual cancellation ───────► refund X, transfer rest
                                                         ├─ maker cancels ─────────────► full refund
                                                         └─ problem reported ──► frozen ──► admin: release / refund / split
```

Every transition is a single database transaction that claims the row first; Stripe calls use idempotency keys and
webhooks are de-duplicated, so retries never pay or refund twice. Amounts are integer cents. The fee
(`PLATFORM_FEE_PERCENT`) is taken from the maker's payout.

## Architecture

```
src/
  app/[locale]/…        pages (server components) — home, makers, request wizard, requests, messages,
                        studio, admin, account, auth, legal, dev tools
  app/api/…             auth, photo upload/serving, Stripe webhook, cron, health, thread polling, exports
  app/actions/…         server actions (thin: auth check → domain function → translated result)
  lib/domain/…          all business rules: requests, quotes, commissions & money, messages, photos,
                        students (verification, tax, payouts), portfolio, reviews, reports, admin, account
  lib/db/               Drizzle schema + connection (Postgres or embedded PGlite)
  lib/payments, email, storage, images, auth, env, crypto, ratelimit …
  components/           UI (server + client components)
  messages/{nl,en}.json all interface text
  content/legal.ts      draft terms, privacy, cookies, company details
drizzle/                SQL migrations
tests/unit, tests/e2e   Vitest and Playwright
```

Security: CSP with per-request nonces, HSTS and the usual headers; HttpOnly session cookies; server actions are
origin-checked and every write re-checks role and ownership in the domain layer; rate limits on sign-in, sign-up,
password reset, uploads, messages, quotes and reports (stored in Postgres, so they hold across instances); photos are
re-encoded server-side (EXIF/GPS removed) and served only through access checks; tax numbers are AES-256-GCM encrypted.

## Going live

The code is complete; these are the remaining infrastructure and account steps.

### 1. Accounts and legal
- [ ] Register the company (KvK) and fill `COMPANY_NAME`, `COMPANY_KVK`, `COMPANY_ADDRESS`, `SUPPORT_EMAIL`.
- [ ] Have a lawyer review `src/content/legal.ts` (terms, privacy policy) and remove the "draft" banner in
      `src/app/[locale]/legal/[doc]/page.tsx`. Sign data processing agreements with the providers below.
- [ ] Check the school email domains in `SCHOOL_EMAIL_DOMAINS`.

### 2. Hosting (pick one)
- **Vercel**: import the repo, set the environment variables, use managed Postgres (Neon/Supabase, EU region) and S3
  storage (local disk does not persist there). `vercel.json` already schedules the cron jobs.
- **Any Docker host** (Fly.io, Render, Railway, a VPS…): `docker build -t atelier .` and run with the environment
  variables; set `RUN_MIGRATIONS=1` for a single instance, or run `node scripts/migrate.mjs` as a release step.
  Schedule the cron calls (below). Local disk storage works on a single server with a persistent volume.
- Point the domain at it, set `APP_URL=https://…`.

### 3. Database
- [ ] Create a Postgres database (EU region), set `DATABASE_URL`.
- [ ] Run `npm run db:migrate` (or `RUN_MIGRATIONS=1`). Enable automatic backups / point-in-time recovery.

### 4. Secrets
```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY  (back it up: tax numbers can't be decrypted without it)
openssl rand -hex 24      # CRON_SECRET
```
The server refuses to start in production if a required variable is missing.

### 5. Stripe
- [ ] Create the Stripe account (NL), activate **Connect** with **Express** accounts, set branding and platform profile.
- [ ] Enable payment methods: **iDEAL**, cards, Bancontact (optional).
- [ ] Set `STRIPE_SECRET_KEY` and add a webhook to `https://<domain>/api/stripe/webhook` with the events
      `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`,
      `account.updated`, `charge.dispute.created`; set `STRIPE_WEBHOOK_SECRET`.
- [ ] Confirm with Stripe how long funds may be held on the platform before transfer for your account (relevant for
      long commissions), and whether cross-border makers need the recipient service agreement.
- [ ] Test the whole flow in Stripe **test mode** first (test keys + test cards / test iDEAL bank).

### 6. Email
- [ ] Pick an SMTP provider, verify the sending domain (SPF, DKIM, DMARC), set `SMTP_URL` and `EMAIL_FROM`.

### 7. Photo storage
- [ ] Create a private S3-compatible bucket (S3, Cloudflare R2, Scaleway…), set `S3_*`. Photos are always served
      through the app's access checks, so the bucket stays private.

### 8. Scheduled jobs
Call with `Authorization: Bearer $CRON_SECRET`:
- every 15 minutes: `GET /api/cron/payments` — automatic release, receipt reminders, abandoned checkouts
- daily: `GET /api/cron/daily` — expire old requests, delete unused uploads, prune rate-limit rows

### 9. Operations
- [ ] Uptime monitor on `/api/health`. Logs are JSON lines on stdout — ship them to your log tool, and optionally add
      Sentry (`@sentry/nextjs`) for error alerts.
- [ ] Add your own email to `ADMIN_EMAILS`, sign up, verify — you get the admin role.
- [ ] Each January: download the DAC7 CSV (`/admin/dac7`) and file it with the Belastingdienst (via their DAC7 portal).

## Not included (deliberately)

Native apps (the site is installable as a web app via its manifest), push notifications, distance search by postcode,
shipping-label integration, and analytics. All can be added without changing the core.
