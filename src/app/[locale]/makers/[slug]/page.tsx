import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { env } from '@/lib/env';
import { getMakerBySlug } from '@/lib/domain/students';
import { getActor } from '@/lib/session';
import { formatEuro } from '@/lib/money';
import { Flat, initials, TINT } from '@/components/flat';
import { Back, Shield, Star } from '@/components/icons';
import { PieceMedia } from '@/components/photos';
import { ReportButton } from '@/components/report';

export async function generateMetadata({ params }: PageProps<'/[locale]/makers/[slug]'>): Promise<Metadata> {
  const { slug, locale } = await params;
  const data = await getMakerBySlug(slug);
  if (!data) return {};
  const m = data.maker;
  return {
    title: `${m.name} — ${m.programme || 'Student maker'}`,
    description: m.bio.slice(0, 160) || undefined,
    alternates: { canonical: `/${locale}/makers/${slug}`, languages: { nl: `/nl/makers/${slug}`, en: `/en/makers/${slug}` } },
    openGraph: { images: m.cover ? [{ url: m.cover.url }] : undefined }
  };
}

export default async function MakerPage({ params, searchParams }: PageProps<'/[locale]/makers/[slug]'>) {
  const { slug, locale } = await params;
  const tab = ((await searchParams).tab as string) || 'portfolio';
  const data = await getMakerBySlug(slug);
  if (!data) notFound();
  const { maker: m, portfolio, reviews } = data;
  const actor = await getActor();
  const t = await getTranslations('maker');
  const tm = await getTranslations('makers');
  const tg = await getTranslations('garment');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const isMe = actor?.id === m.id;
  const open = m.accepting && m.payoutsEnabled;
  const canRequest = open && (!actor || actor.role === 'customer');
  const first = m.name.split(' ')[0];
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Person', name: m.name, jobTitle: 'Fashion design student',
    affiliation: m.school || undefined, address: m.city ? { '@type': 'PostalAddress', addressLocality: m.city } : undefined,
    url: `${env().APP_URL}/${locale}/makers/${slug}`,
    ...(m.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: m.rating, reviewCount: m.reviews } } : {})
  };
  const tabs = [['portfolio', t('portfolio'), portfolio.length], ['reviews', t('reviewsTab'), reviews.length], ['about', t('about'), 0]] as const;
  return (
    <div className="wrap flex flex-col gap-12 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Link href="/makers" className="inline-flex items-center gap-2 text-[14px] text-muted no-underline"><Back /> {t('allMakers')}</Link>
      <section className="flex flex-wrap items-start gap-12">
        <div className="arch tint-sage h-[420px] min-w-[240px] flex-[0_1_340px] flex-col text-sage-deep">
          {m.cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={m.cover.url} alt="" className="absolute inset-0 size-full object-cover" />
            : <span className="font-serif text-[96px] leading-none">{initials(m.name)}</span>}
        </div>
        <div className="flex flex-[1_1_480px] flex-col gap-5 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {open ? <span className="badge badge-sage"><span className="dot" />{tm('accepting')}</span> : <span className="badge badge-sand">{t('pausedLong')}</span>}
            {m.verified ? <span className="tag text-sage-deep"><Shield size={16} />{tc('verifiedStudent')}</span> : <span className="tag">{tc('studentMaker')}</span>}
          </div>
          <h1 className="display !text-[clamp(52px,6vw,88px)]">{m.name}</h1>
          <p className="text-[17px] text-ink-soft">{[m.programme, m.school, m.year, m.city].filter(Boolean).join(' · ')}</p>
          {m.bio && <p className="max-w-[600px] whitespace-pre-line text-[18px]">{m.bio}</p>}
          {m.skills.length > 0 && <div className="flex flex-wrap gap-2">{m.skills.map((s) => <span key={s} className="tag">{s}</span>)}</div>}
          <dl className="flex max-w-[640px] flex-wrap gap-8 border-y border-dashed border-seam-strong py-4">
            <div><dt className="sr-only">{t('piecesStat')}</dt><dd className="font-serif text-[30px]">{m.pieces}</dd><span className="text-[13px] text-muted">{t('piecesStat')}</span></div>
            <div><dt className="sr-only">{t('deliveredStat')}</dt><dd className="font-serif text-[30px]">{m.delivered}</dd><span className="text-[13px] text-muted">{t('deliveredStat')}</span></div>
            {m.rating && <div><dt className="sr-only">{t('ratingStat')}</dt><dd className="inline-flex items-center gap-1 font-serif text-[30px]">{m.rating.toFixed(1)}<Star size={18} filled /></dd><span className="block text-[13px] text-muted">{t('ratingStat')}</span></div>}
            {m.turnaround && <div><dt className="sr-only">{t('turnaroundStat')}</dt><dd className="font-serif text-[30px]">{m.turnaround}</dd><span className="text-[13px] text-muted">{t('turnaroundStat')}</span></div>}
          </dl>
          <div className="flex flex-wrap items-center gap-4">
            {isMe ? <Link className="btn btn-sage btn-lg" href="/studio/profile">{t('editInStudio')}</Link>
              : canRequest ? <Link className="btn btn-sage btn-lg" href={`/request?maker=${m.slug}`}>{t('requestFrom', { name: first })}</Link>
              : !open ? <Link className="btn btn-line btn-lg" href={`/makers?garment=${m.specialities[0] ?? ''}`}>{t('findSimilar')}</Link> : null}
            {actor && !isMe && <ReportButton targetType="user" targetId={m.id} />}
          </div>
        </div>
      </section>

      {m.rates.length > 0 && (
        <section className="card flex flex-wrap gap-8" aria-labelledby="rates-h">
          <div className="flex flex-[1_1_240px] flex-col gap-1"><h2 id="rates-h" className="h3">{t('rateGuide', { name: first })}</h2><span className="text-[14px] text-muted">{t('rateGuideNote')}</span></div>
          <div className="grid flex-[1_1_520px] grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            {m.rates.map((r) => <div key={r.label} className="flex flex-col rounded-[22px] bg-linen px-5 py-4"><span className="text-[14px] text-ink-soft">{r.label}</span><span className="font-serif text-[28px]">{tc('from', { amount: formatEuro(r.fromCents, locale) })}</span></div>)}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-8">
        <nav className="tabs" aria-label={m.name}>
          {tabs.map(([k, label, n]) => <Link key={k} href={`/makers/${slug}?tab=${k}`} className="tab" aria-current={tab === k ? 'page' : undefined} scroll={false}>{label}{n ? <span className="count">{n}</span> : null}</Link>)}
        </nav>
        {tab === 'portfolio' && (portfolio.length ? (
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {portfolio.map((p) => (
              <article key={p.id} className="flex flex-col gap-3">
                <PieceMedia title={p.title} garment={p.garment} photos={p.photos} label={t('viewPhotos', { title: p.title })} />
                <div className="flex items-start justify-between gap-3"><h3 className="h4 text-[17px]">{p.title}</h3><span className={`badge ${p.kind === 'commission' ? 'badge-sage' : 'badge-sand'}`}>{t(p.kind)}</span></div>
                <span className="text-[14px] text-muted">{[p.material, tg(p.garment)].filter(Boolean).join(' · ')}</span>
                {p.story && <p className="text-[14px] text-ink-soft">{p.story}</p>}
              </article>
            ))}
          </div>
        ) : <div className="empty">{t('noPortfolio')}</div>)}
        {tab === 'reviews' && (reviews.length ? (
          <ul className="flex list-none flex-col gap-4 p-0">
            {reviews.map((r) => (
              <li key={r.id} className="card flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex gap-0.5 text-clay" aria-label={`${r.rating}/5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= r.rating} />)}</span>
                  <span className="text-[13px] text-muted">{r.customer} · {f.dateTime(r.createdAt, { month: 'long', year: 'numeric' })}</span>
                </div>
                {r.body && <p className="whitespace-pre-line">{r.body}</p>}
                {r.reply && <div className="rounded-[18px] bg-linen px-4 py-3 text-[15px]"><span className="label">{t('replyFrom', { name: first })}</span><p className="mt-1 text-ink-soft">{r.reply}</p></div>}
                {actor && <div className="self-end"><ReportButton targetType="review" targetId={r.id} /></div>}
              </li>
            ))}
          </ul>
        ) : <div className="empty">{t('noReviews')}</div>)}
        {tab === 'about' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {m.specialities.map((g) => (
              <div key={g} className="card flex items-center gap-4"><div className={`thumb ${TINT[g]}`}><Flat garment={g} width={38} height={50} bold /></div>
                <div className="flex flex-col"><span className="h4">{tg(g)}</span><span className="text-[14px] text-muted">{t('takesRequests')}</span></div></div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
