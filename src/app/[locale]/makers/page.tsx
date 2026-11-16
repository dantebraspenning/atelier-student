import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { GARMENTS } from '@/lib/db/schema';
import { listMakers } from '@/lib/domain/students';
import { Search } from '@/components/icons';
import { MakerCard } from '@/components/maker-card';

export async function generateMetadata({ params }: PageProps<'/[locale]/makers'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'makers' });
  return { title: t('title'), description: t('lead') };
}

export default async function Makers({ searchParams }: PageProps<'/[locale]/makers'>) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const garment = one(sp.garment);
  const open = one(sp.open) === '1';
  const q = one(sp.q).slice(0, 80);
  const t = await getTranslations('makers');
  const tg = await getTranslations('garments');
  const makers = await listMakers({ garment, open, q });
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(garment && { garment }), ...(open && { open: '1' }), ...(q && { q }), ...over });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/makers${p.size ? `?${p}` : ''}`;
  };
  return (
    <div className="wrap flex flex-col gap-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-[640px] flex-col gap-3">
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1 className="h1">{t('title')}</h1>
          <p className="lead">{t('lead')}</p>
        </div>
        <form role="search" className="flex flex-[0_1_440px] items-center gap-2 rounded-full border border-seam-strong bg-cotton py-1.5 pl-5 pr-1.5">
          <label htmlFor="q" className="sr-only">{t('searchLabel')}</label><Search />
          <input id="q" name="q" type="search" defaultValue={q} placeholder={t('searchPlaceholder')} className="min-w-0 flex-1 bg-transparent py-2 outline-none" />
          {garment && <input type="hidden" name="garment" value={garment} />}
          {open && <input type="hidden" name="open" value="1" />}
          <button className="btn btn-sage btn-sm">{t('search')}</button>
        </form>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-seam py-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
          <Link className="chip" href={href({ garment: '' })} aria-pressed={!garment}>{t('all')}</Link>
          {GARMENTS.map((g) => <Link key={g} className="chip" href={href({ garment: g })} aria-pressed={garment === g}>{tg(g)}</Link>)}
        </div>
        <div className="flex items-center gap-5">
          <Link className="chip" href={href({ open: open ? '' : '1' })} aria-pressed={open}>{t('openOnly')}</Link>
          <span className="text-[14px] text-muted" aria-live="polite">{t('count', { count: makers.length })}</span>
        </div>
      </div>
      {makers.length
        ? <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{makers.map((m) => <MakerCard key={m.id} m={m} />)}</div>
        : <div className="empty">{t('empty')}</div>}
      <div className="block-sand flex flex-wrap items-center justify-between gap-6 !rounded-[40px] !py-10">
        <div className="flex flex-col gap-2"><h2 className="h3 text-[36px]">{t('notSureTitle')}</h2><p className="text-ink-soft">{t('notSure')}</p></div>
        <Link className="btn btn-sage btn-lg" href="/request">{t('postRequest')}</Link>
      </div>
    </div>
  );
}
