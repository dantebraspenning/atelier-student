import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Maker } from '@/lib/domain/students';
import { Flat, TINT } from './flat';
import { Shield, Star } from './icons';

export async function MakerCard({ m }: { m: Maker }) {
  const t = await getTranslations('makers');
  const tg = await getTranslations('garments');
  const tc = await getTranslations('common');
  const g = m.specialities[0] ?? 'dress';
  const open = m.accepting && m.payoutsEnabled;
  return (
    <Link href={`/makers/${m.slug}`} className="group flex flex-col gap-3 text-ink no-underline">
      <div className={`arch h-[320px] ${m.cover ? 'bg-sand' : TINT[g]} transition-transform group-hover:-translate-y-1`}>
        {m.cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={m.cover.thumbUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
          : <Flat garment={g} />}
        <span className={`badge absolute bottom-3.5 left-3.5 ${open ? 'badge-paper' : 'badge-sand'}`}>{open ? t('accepting') : t('paused')}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-serif text-[26px] leading-tight">{m.name}</span>
        {m.verified && <span className="text-sage-deep" title={tc('verifiedStudent')}><Shield size={18} /><span className="sr-only">{tc('verifiedStudent')}</span></span>}
      </div>
      <span className="text-[15px] text-ink-soft">{m.specialities.map((s) => tg(s)).join(' · ')}{m.city ? ` — ${m.city}` : ''}</span>
      <div className="flex justify-between border-t border-dashed border-seam-strong pt-3 text-[14px] text-muted">
        <span>{t('pieces', { count: m.pieces })}</span>
        <span className="inline-flex items-center gap-1">{m.rating ? <><Star size={14} filled />{m.rating.toFixed(1)} · </> : null}{t('reviews', { count: m.reviews })}</span>
      </div>
    </Link>
  );
}
