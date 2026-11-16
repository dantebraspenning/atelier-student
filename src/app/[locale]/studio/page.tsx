import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { readiness, getOwnProfile } from '@/lib/domain/students';
import { studentFeed, studentQuotes } from '@/lib/domain/requests';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { Flat, TINT } from '@/components/flat';
import { Camera, Chat } from '@/components/icons';
import { PhotoStrip } from '@/components/photos';
import { PassButton, QuoteComposer, WithdrawButton } from '@/components/studio-forms';

export async function generateMetadata() { return { title: 'Studio', robots: { index: false } }; }

export default async function StudioRequests({ params, searchParams }: PageProps<'/[locale]/studio'>) {
  const { locale } = await params;
  const sp = await searchParams;
  const actor = await requirePageActor(locale, '/studio', 'student');
  const db = await getDb();
  const [feed, quotes, profile, ready] = await Promise.all([studentFeed(actor), studentQuotes(actor), getOwnProfile(actor.id), readiness(db, actor.id)]);
  const sel = feed.find((r) => r.id === sp.r) ?? feed[0];
  const t = await getTranslations('studio');
  const tg = await getTranslations('garment');
  const tgs = await getTranslations('garments');
  const tm = await getTranslations('measure');
  const td = await getTranslations('delivery');
  const ts = await getTranslations('status');
  const f = await getFormatter();
  const date = (d: string) => f.dateTime(new Date(`${d}T12:00:00`), { day: 'numeric', month: 'short' });
  return (
    <section className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3"><h2 className="h3">{t('feedTitle')}</h2>
          <span className="text-[13px] text-muted">{profile.specialities.map((g) => tgs(g)).join(' · ') || t('noGarments')}</span></div>
        {!profile.accepting && <div className="notice notice-clay text-[14px]">{t('pausedNotice')}</div>}
        {feed.length ? feed.map((r) => (
          <Link key={r.id} href={`/studio?r=${r.id}`} scroll={false} className="list-row" aria-current={sel?.id === r.id ? 'true' : undefined}>
            <span className={`thumb ${TINT[r.garment]}`}><Flat garment={r.garment} width={38} height={50} bold /></span>
            <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="h4 text-[16px]">{r.title}</span>
              <span className="text-[13px] text-muted">{r.customer}{r.city ? ` · ${r.city}` : ''}{r.neededBy ? ` · ${t('neededBy', { date: date(r.neededBy) })}` : ''}</span></span>
            {r.photos.length > 0 && <span className="inline-flex items-center gap-1 text-[13px] text-muted"><Camera size={15} />{r.photos.length}</span>}
            <span className={`badge ${r.direct ? 'badge-sage' : 'badge-clay'}`}>{r.direct ? t('forYou') : t('new')}</span>
          </Link>
        )) : <div className="empty">{t('feedEmpty')}</div>}
        {quotes.length > 0 && (<>
          <h3 className="h4 mt-5">{t('quotesSent')}</h3>
          <ul className="flex list-none flex-col p-0">
            {quotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 border-b border-dashed border-seam-strong py-3">
                <Link href={`/messages/${q.requestId}/${actor.id}`} className="flex flex-col no-underline"><span>{q.title}</span><span className="text-[13px] text-muted">{q.customer} · {formatEuro(q.totalCents, locale)}</span></Link>
                <span className="flex items-center gap-3">{q.status === 'pending' && q.requestStatus === 'open' && <WithdrawButton quoteId={q.id} />}
                  <span className={`badge ${q.status === 'pending' ? 'badge-sand' : 'badge-clay'}`}>{ts(`quote_${q.status}`)}</span></span>
              </li>
            ))}
          </ul>
        </>)}
      </div>
      {sel && (
        <article className="card flex min-w-0 flex-[1_1_420px] flex-col gap-5" aria-labelledby="sel-h">
          <div className="flex items-start gap-4">
            <span className={`arch ${TINT[sel.garment]} h-[112px] w-[88px] flex-none`}><Flat garment={sel.garment} width={54} height={72} bold /></span>
            <div className="flex flex-col gap-1"><span className="eyebrow text-muted">{t('requestFrom', { name: sel.customer })}</span><h3 id="sel-h" className="h3">{sel.title}</h3></div>
          </div>
          <p className="whitespace-pre-line text-ink-soft">{sel.description}</p>
          <PhotoStrip photos={sel.photos} />
          <div className="flex flex-wrap gap-2">
            <span className="tag">{tg(sel.garment)}</span>{sel.purpose && <span className="tag">{sel.purpose}</span>}
            <span className="tag">{sel.fabric === 'own' ? t('yourOwnFabric') : t('youSource')}</span>
            <span className="tag">{sel.budgetCents != null ? t('budget', { amount: formatEuro(sel.budgetCents, locale) }) : t('noBudget')}</span>
            {sel.neededBy && <span className="tag">{t('neededBy', { date: date(sel.neededBy) })}</span>}
            <span className="tag">{td(sel.delivery)}{sel.city ? ` · ${sel.city}` : ''}</span>
          </div>
          <div className="flex flex-col gap-1 text-[15px]"><span className="label">{t('measurements')}</span>
            <span className="text-ink-soft">{Object.keys(sel.measurements).length ? Object.entries(sel.measurements).map(([k, v]) => `${tm.has(k) ? tm(k) : k} ${v} cm`).join(' · ') : t('measureInPerson')}</span></div>
          <hr className="stitch" />
          <QuoteComposer key={sel.id} requestId={sel.id} delivery={sel.delivery} fabric={sel.fabric} customerFirst={sel.customer.split(' ')[0]}
            feePercent={env().PLATFORM_FEE_PERCENT} canQuote={ready.ready && profile.accepting} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-seam pt-4">
            <Link className="text-link" href={`/messages/${sel.id}/${actor.id}`}><Chat /> {t('askFirst', { name: sel.customer.split(' ')[0] })}</Link>
            <PassButton requestId={sel.id} />
          </div>
        </article>
      )}
    </section>
  );
}
