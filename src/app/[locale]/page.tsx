import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { GARMENTS } from '@/lib/db/schema';
import { listMakers } from '@/lib/domain/students';
import { formatEuro } from '@/lib/money';
import { Flat } from '@/components/flat';
import { Arrow, Check, Stitch } from '@/components/icons';
import { MakerCard } from '@/components/maker-card';

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  const t = await getTranslations('home');
  const tg = await getTranslations('garment');
  const makers = await listMakers({ open: true }).catch(() => []);
  const from: Partial<Record<string, number>> = {};
  for (const m of makers) for (const g of m.specialities) for (const r of m.rates) {
    if (r.label.toLowerCase().includes(g === 'rework' ? 'rework' : g.slice(0, 4)) || m.specialities.length === 1) from[g] = Math.min(from[g] ?? Infinity, r.fromCents);
  }
  const featured = makers.slice(0, 3);
  return (
    <>
      <section className="wrap flex flex-wrap items-center gap-12 py-14 md:py-20">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          <span className="badge badge-paper w-fit"><span className="dot" />{t('badge')}</span>
          <h1 className="display">{t.rich('title', { em: (c) => <em className="accent">{c}</em> })}</h1>
          <p className="lead">{t('lead')}</p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn btn-sage btn-lg" href="/request">{t('ctaRequest')} <Arrow /></Link>
            <Link className="btn btn-line btn-lg" href="/makers">{t('ctaBrowse')}</Link>
          </div>
        </div>
        <div aria-hidden className="relative h-[460px] min-w-[300px] flex-[1_1_420px]">
          <div className="arch tint-sage absolute left-0 top-0 h-[400px] w-[62%]"><Flat garment="dress" width={200} height={280} /></div>
          <div className="arch tint-sand absolute bottom-0 right-0 h-[300px] w-[44%]"><Flat garment="trousers" width={150} height={210} /></div>
          {featured[0] && (
            <div className="card absolute bottom-10 left-[18%] flex w-[260px] flex-col gap-2 shadow-sm">
              <span className="eyebrow text-muted">{t('floatEyebrow')}</span>
              <span className="h4 font-serif text-[24px] font-normal">{t('floatTitle')}</span>
              <span className="text-[14px] text-ink-soft">{featured[0].name} · {featured[0].programme}</span>
            </div>
          )}
        </div>
      </section>

      <section aria-label={t('peopleAsk')} className="border-y border-seam">
        <div className="wrap flex flex-wrap items-center gap-3 py-5">
          <span className="eyebrow text-muted">{t('peopleAsk')}</span>
          {GARMENTS.map((g) => <Link key={g} className="chip" href={`/request?garment=${g}`}>{tg(g)}</Link>)}
        </div>
      </section>

      <section id="how" className="wrap flex scroll-mt-24 flex-col gap-12 py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="h2 max-w-[640px]">{t('howTitle')}</h2>
          <p className="max-w-[380px] text-ink-soft">{t('howLead')}</p>
        </div>
        <ol className="grid list-none gap-5 p-0 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="card flex flex-col gap-4">
              <span className="font-serif text-[22px] text-sage">0{n}</span>
              <h3 className="h4">{t(`step${n}Title`)}</h3>
              <p className="text-ink-soft">{t(`step${n}`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap pb-20">
        <div className="block-sand flex flex-wrap gap-12">
          <div className="flex flex-[1_1_420px] flex-col gap-5">
            <span className="eyebrow">{t('pricingEyebrow')}</span>
            <h2 className="h2">{t('pricingTitle')}</h2>
            <p className="max-w-[460px] text-ink-soft">{t('pricingLead')}</p>
            <ul className="flex list-none flex-col gap-3 p-0">
              {(['pricing1', 'pricing2', 'pricing3'] as const).map((k) => <li key={k} className="flex gap-3 text-sage-deep"><Check /><span className="text-ink">{t(k)}</span></li>)}
            </ul>
          </div>
          <div className="card flex max-w-[440px] flex-[1_1_320px] flex-col gap-3">
            <h3 className="h3">{t('ratesTitle')}</h3>
            <hr className="stitch" />
            {GARMENTS.filter((g) => from[g]).length
              ? GARMENTS.filter((g) => from[g]).map((g) => <div key={g} className="flex justify-between"><span className="text-ink-soft">{tg(g)}</span><span>{formatEuro(from[g]!, locale)}+</span></div>)
              : <p className="text-ink-soft">{t('ratesEmpty')}</p>}
            <hr className="stitch" />
            <span className="text-[13px] text-muted">{t('ratesNote')}</span>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="wrap flex flex-col gap-8 pb-24">
          <div className="flex flex-wrap items-end justify-between gap-5"><h2 className="h2">{t('makersTitle')}</h2><Link className="text-link" href="/makers">{t('ctaBrowse')} <Arrow /></Link></div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{featured.map((m) => <MakerCard key={m.id} m={m} />)}</div>
        </section>
      )}

      <section className="bg-sage text-linen">
        <div className="wrap flex flex-wrap gap-12 py-20">
          <div className="flex flex-[1_1_460px] flex-col gap-6">
            <span className="eyebrow text-sage-mist">{t('studentsEyebrow')}</span>
            <h2 className="h2">{t('studentsTitle')}</h2>
            <p className="max-w-[480px] text-[18px] text-[#E4E8DC]">{t('studentsLead')}</p>
            <div><Link className="btn btn-paper btn-lg" href="/sign-up?role=student">{t('studentsCta')}</Link></div>
          </div>
          <div className="grid flex-[1_1_420px] gap-4 sm:grid-cols-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <div key={n} className="flex flex-col gap-2 rounded-[28px] border border-linen/30 p-6">
                <span className="font-serif text-[26px]">{t(`feature${n}Title`)}</span>
                <span className="text-[15px] text-[#E4E8DC]">{t(`feature${n}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap flex flex-col items-center gap-6 py-20 text-center">
        <Stitch />
        <h2 className="h2 max-w-[860px]">{t('finalTitle')}</h2>
        <p className="lead">{t('finalLead')}</p>
        <Link className="btn btn-ink btn-lg" href="/request">{t('finalCta')}</Link>
      </section>
    </>
  );
}
