import { getFormatter, getTranslations } from 'next-intl/server';
import { ownReviews } from '@/lib/domain/reviews';
import { requirePageActor } from '@/lib/session';
import { Star } from '@/components/icons';
import { ReplyForm } from '@/components/studio-forms';

export default async function StudioReviews({ params }: PageProps<'/[locale]/studio/reviews'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/studio/reviews', 'student');
  const reviews = await ownReviews(actor);
  const t = await getTranslations('studio');
  const f = await getFormatter();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="h3">{t('reviewsTitle')}</h2>
      {reviews.length ? reviews.map((r) => (
        <article key={r.id} className="card flex flex-col gap-3">
          <div className="flex items-center justify-between"><span className="inline-flex gap-0.5 text-clay" aria-label={`${r.rating}/5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= r.rating} />)}</span>
            <span className="text-[13px] text-muted">{f.dateTime(r.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
          {r.body && <p className="whitespace-pre-line">{r.body}</p>}
          {r.reply ? <div className="rounded-[18px] bg-linen px-4 py-3 text-[15px] text-ink-soft">{r.reply}</div> : <ReplyForm id={r.id} />}
        </article>
      )) : <div className="empty">{t('noReviewsYet')}</div>}
    </section>
  );
}
