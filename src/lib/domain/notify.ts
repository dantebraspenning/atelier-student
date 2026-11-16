import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { notification, user } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import type { EmailTemplate } from '@/lib/email/templates';
import { formatEuro } from '@/lib/money';

export type Notice = {
  userId: string;
  /** In-app notification type; translated under `notifications.<type>`. */
  type: string;
  values?: Record<string, string | number>;
  /** Locale-less path, e.g. `/requests/…`. */
  path: string;
  email?: EmailTemplate;
};

const MONEY = new Set(['total', 'amount', 'fee', 'refund', 'payout']);
const HOW = { nl: { shipping: 'verzonden', in_person: 'overhandigd' }, en: { shipping: 'shipped', in_person: 'handed over' } } as const;

function localise(values: Record<string, string | number>, locale: 'nl' | 'en') {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (MONEY.has(k) && typeof v === 'number') out[k] = formatEuro(v, locale);
    else if (k === 'how' && (v === 'shipping' || v === 'in_person')) out[k] = HOW[locale][v];
    else if (k === 'date' && typeof v === 'string') out[k] = new Date(v).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'long' });
    else out[k] = v;
  }
  return out;
}

/** Store in-app notifications and send their emails. Call after the database transaction commits. */
export async function deliver(notices: Notice[]) {
  if (!notices.length) return;
  const db = await getDb();
  const ids = [...new Set(notices.map((n) => n.userId))];
  const users = await db.select({ id: user.id, email: user.email, name: user.name, locale: user.locale, deletedAt: user.deletedAt })
    .from(user).where(inArray(user.id, ids));
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const n of notices) {
    const u = byId.get(n.userId);
    if (!u || u.deletedAt) continue;
    await db.insert(notification).values({ userId: u.id, type: n.type, values: n.values ?? {}, href: n.path });
    if (n.email) {
      await sendEmail({ to: u.email, template: n.email, locale: u.locale, values: { name: u.name.split(' ')[0], ...localise(n.values ?? {}, u.locale) }, url: `/${u.locale}${n.path}` });
    }
  }
}

export async function adminIds() {
  const db = await getDb();
  return (await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin'))).map((u) => u.id);
}

export async function alertAdmins(subject: string, text: string, path: string) {
  const ids = await adminIds();
  await deliver(ids.map((userId) => ({ userId, type: 'adminAlert', values: { subject, text }, path, email: 'adminAlert' as const })));
}
