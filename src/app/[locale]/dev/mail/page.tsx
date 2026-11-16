import { desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { emailOutbox } from '@/lib/db/schema';
import { emailLoggedOnly, isProduction } from '@/lib/env';

/** Local mailbox: every email the app would have sent while no SMTP server is configured. */
export default async function DevMail({ searchParams }: PageProps<'/[locale]/dev/mail'>) {
  if (isProduction() || !emailLoggedOnly()) notFound();
  const sp = await searchParams;
  const db = await getDb();
  const mails = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(50);
  const open = mails.find((m) => m.id === sp.id) ?? mails[0];
  const links = open ? [...open.text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]) : [];
  return (
    <div className="wrap grid gap-6 py-10 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-2">
        <h1 className="h3">Dev mailbox</h1>
        {mails.map((m) => (
          <a key={m.id} href={`?id=${m.id}`} className={`list-row !py-2.5 text-[14px] ${open?.id === m.id ? '!border-sage bg-cotton' : ''}`}>
            <span className="flex min-w-0 flex-col"><span className="truncate font-medium">{m.subject}</span><span className="truncate text-muted">{m.to}</span></span>
          </a>
        ))}
        {!mails.length && <p className="text-muted">No emails yet.</p>}
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          <div className="text-[14px] text-muted">To {open.to} · {open.template}</div>
          {links.map((l) => <a key={l} className="text-link break-all" href={l}>{l}</a>)}
          <pre className="whitespace-pre-wrap rounded-3xl border border-seam bg-cotton p-6 font-sans text-[15px]">{open.text}</pre>
        </div>
      )}
    </div>
  );
}
