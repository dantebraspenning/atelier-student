import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getActor } from '@/lib/session';
import { signOutAction } from '@/app/actions/auth';
import { Badges, LocaleSwitch } from './header-client';
import { Bell, Menu } from './icons';

export async function Header({ locale }: { locale: string }) {
  const t = await getTranslations('nav');
  const actor = await getActor();
  const links: { href: string; label: string; badge?: 'messages' }[] = !actor
    ? [{ href: '/makers', label: t('findMaker') }, { href: '/#how', label: t('howItWorks') }, { href: '/sign-up?role=student', label: t('forStudents') }]
    : actor.role === 'customer'
      ? [{ href: '/makers', label: t('findMaker') }, { href: '/requests', label: t('myRequests') }, { href: '/messages', label: t('messages'), badge: 'messages' }]
      : actor.role === 'student'
        ? [{ href: '/studio', label: t('studio') }, { href: '/messages', label: t('messages'), badge: 'messages' }, { href: '/makers', label: t('findMaker') }]
        : [{ href: '/admin', label: t('admin') }, { href: '/makers', label: t('findMaker') }];
  const cta = !actor
    ? <Link className="btn btn-ink btn-sm" href="/request">{t('request')}</Link>
    : actor.role === 'customer' ? <Link className="btn btn-ink btn-sm" href="/request">{t('request')}</Link> : null;

  const nav = (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center gap-2 text-[15px] text-ink-soft hover:text-ink">
          {l.label}{l.badge && <Badges kind="messages" />}
        </Link>
      ))}
      {actor ? (
        <>
          <Link href="/notifications" aria-label={t('notifications')} className="relative inline-flex min-h-11 items-center gap-1 text-ink-soft hover:text-ink">
            <Bell /><Badges kind="notifications" />
          </Link>
          <Link href="/account" className="inline-flex min-h-11 items-center text-[15px] text-ink-soft hover:text-ink">{t('account')}</Link>
          <form action={signOutAction}><input type="hidden" name="locale" value={locale} />
            <button className="inline-flex min-h-11 items-center text-[15px] text-ink-soft hover:text-ink">{t('signOut')}</button>
          </form>
        </>
      ) : <Link href="/sign-in" className="inline-flex min-h-11 items-center text-[15px] text-ink-soft hover:text-ink">{t('signIn')}</Link>}
      <LocaleSwitch />
      {cta}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-seam/70 bg-linen/90 backdrop-blur">
      <div className="wrap flex min-h-[72px] items-center justify-between gap-6">
        <Link href="/" className="flex items-baseline gap-2 no-underline">
          <span className="font-serif text-[30px] leading-none">atelier</span>
          <span className="text-[11px] uppercase tracking-[.14em] text-muted">student</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">{nav}</nav>
        <details className="relative lg:hidden">
          <summary className="btn btn-ghost btn-sm" aria-label={t('menu')}><Menu /></summary>
          <nav aria-label="Main" className="absolute right-0 top-14 flex w-64 flex-col items-start gap-1 rounded-3xl border border-seam bg-cotton p-5 shadow-lg">{nav}</nav>
        </details>
      </div>
    </header>
  );
}
