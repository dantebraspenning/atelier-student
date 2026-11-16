import { getDb } from '@/lib/db';
import { emailOutbox } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { renderEmail, type EmailTemplate, type Locale } from './templates';

type Transport = { sendMail: (m: { from: string; to: string; subject: string; html: string; text: string }) => Promise<unknown> };
let transport: Transport | undefined;

async function getTransport(): Promise<Transport | undefined> {
  const url = env().SMTP_URL;
  if (!url) return undefined;
  if (!transport) {
    const nodemailer = await import('nodemailer');
    transport = nodemailer.createTransport(url) as unknown as Transport;
  }
  return transport;
}

export type SendEmail = {
  to: string;
  template: EmailTemplate;
  locale?: Locale;
  values?: Record<string, string | number>;
  /** Path (e.g. /nl/requests/…) or absolute URL for the call-to-action button. */
  url?: string;
};

/**
 * Render and send a transactional email. Every email is recorded in the outbox
 * (without SMTP configured, that is the only place it goes — see /dev/mail).
 * Failures are logged, never thrown: an email problem must not undo a payment or a message.
 */
export async function sendEmail({ to, template, locale = 'nl', values = {}, url }: SendEmail) {
  const absolute = url ? (url.startsWith('http') ? url : `${env().APP_URL}${url}`) : undefined;
  const { subject, html, text } = renderEmail(template, locale, values, absolute, env().COMPANY_NAME);
  const db = await getDb();
  let status: 'logged' | 'sent' | 'failed' = 'logged';
  let error: string | null = null;
  try {
    const t = await getTransport();
    if (t) { await t.sendMail({ from: env().EMAIL_FROM, to, subject, html, text }); status = 'sent'; }
    else if (env().NODE_ENV === 'development') console.info(`[email] to=${to} subject="${subject}" ${absolute ?? ''}`);
  } catch (e) {
    status = 'failed';
    error = String(e);
    console.error(JSON.stringify({ level: 'error', msg: 'email failed', template, error }));
  }
  await db.insert(emailOutbox).values({ to, template, subject, html, text, status, error });
}
