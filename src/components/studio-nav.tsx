'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export function StudioNav({ counts }: { counts: Record<string, number> }) {
  const t = useTranslations('studio.nav');
  const path = usePathname();
  const items = [['/studio', 'requests'], ['/studio/commissions', 'commissions'], ['/studio/portfolio', 'portfolio'], ['/studio/reviews', 'reviews'], ['/studio/profile', 'profile'], ['/studio/setup', 'setup']] as const;
  return (
    <nav aria-label="Studio" className="flex flex-wrap gap-1 lg:flex-col">
      {items.map(([href, key]) => (
        <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}
          className="flex min-h-11 items-center gap-3 rounded-full px-4 text-ink-soft no-underline hover:text-ink aria-[current=page]:bg-sand aria-[current=page]:font-medium aria-[current=page]:text-ink">
          {t(key)}{counts[key] ? <span className="count ml-auto">{counts[key]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
