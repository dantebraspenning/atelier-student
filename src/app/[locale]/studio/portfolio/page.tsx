import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ownPortfolio, portfolioCandidates } from '@/lib/domain/portfolio';
import { getOwnProfile } from '@/lib/domain/students';
import { requirePageActor } from '@/lib/session';
import { Arrow } from '@/components/icons';
import { PieceMedia } from '@/components/photos';
import { PieceActions, PieceForm } from '@/components/studio-forms';

export default async function StudioPortfolio({ params, searchParams }: PageProps<'/[locale]/studio/portfolio'>) {
  const { locale } = await params;
  const sp = await searchParams;
  const actor = await requirePageActor(locale, '/studio/portfolio', 'student');
  const [pieces, candidates, profile] = await Promise.all([ownPortfolio(actor), portfolioCandidates(actor), getOwnProfile(actor.id)]);
  const from = candidates.find((c) => c.id === sp.from) ?? null;
  const t = await getTranslations('studio');
  const tm = await getTranslations('maker');
  return (
    <section className="flex flex-wrap items-start gap-6">
      <div className="flex max-w-[460px] flex-[1_1_340px] flex-col gap-3">
        <PieceForm key={from?.id ?? 'new'} from={from} defaultGarment={profile.specialities[0] ?? 'dress'} />
        {!from && candidates.length > 0 && candidates.map((c) => (
          <Link key={c.id} href={`/studio/portfolio?from=${c.id}`} className="list-row !py-3"><span className="flex-1">{t('fromCommission', { title: c.title })}</span><Arrow /></Link>
        ))}
      </div>
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3"><h2 className="h3">{t('yourPortfolio')} <span className="text-muted">({pieces.length})</span></h2>
          <Link className="text-link" href={`/makers/${profile.slug}`}>{t('viewPublic')} <Arrow /></Link></div>
        {pieces.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
            {pieces.map((p) => (
              <article key={p.id} className="flex flex-col gap-2">
                <PieceMedia title={p.title} garment={p.garment} photos={p.photos} height={220} label={tm('viewPhotos', { title: p.title })} />
                <div className="flex items-start justify-between gap-2"><span className="text-[15px] font-medium">{p.title}</span></div>
                <span className="text-[13px] text-muted">{tm(p.kind)}{p.material ? ` · ${p.material}` : ''}{p.hiddenAt ? ` · ${t('hiddenByModerator')}` : ''}</span>
                <PieceActions id={p.id} />
              </article>
            ))}
          </div>
        ) : <div className="empty">{t('portfolioEmpty')}</div>}
      </div>
    </section>
  );
}
