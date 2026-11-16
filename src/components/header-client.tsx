'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { setLocaleAction } from '@/app/actions/auth';

type Counts = { messages: number; notifications: number };
let shared: Counts = { messages: 0, notifications: 0 };
const listeners = new Set<(c: Counts) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

async function poll() {
  if (document.hidden) return;
  try {
    const res = await fetch('/api/unread', { cache: 'no-store' });
    if (res.ok) { shared = await res.json(); listeners.forEach((l) => l(shared)); }
  } catch { /* offline */ }
}

/** Unread badge, polled every 20 seconds and shared by every badge on the page. */
export function Badges({ kind }: { kind: keyof Counts }) {
  const [counts, setCounts] = useState(shared);
  useEffect(() => {
    listeners.add(setCounts);
    if (!timer) { void poll(); timer = setInterval(poll, 20000); }
    return () => { listeners.delete(setCounts); if (!listeners.size) { clearInterval(timer); timer = undefined; } };
  }, []);
  const n = counts[kind];
  if (!n) return null;
  return <span className="count count-clay" aria-label={String(n)}>{n > 99 ? '99+' : n}</span>;
}

export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('common');
  const other = locale === 'nl' ? 'en' : 'nl';
  return (
    <Link href={pathname} locale={other} hrefLang={other} onClick={() => { void setLocaleAction(other); }}
      className="inline-flex min-h-11 items-center text-[14px] uppercase tracking-wider text-muted hover:text-ink" aria-label={t('switchTo')}>
      {other}
    </Link>
  );
}
