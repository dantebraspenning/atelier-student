import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCustomerRequest } from '@/lib/domain/requests';
import { listThreads } from '@/lib/domain/messages';
import { overdueForReport, releaseDate } from '@/lib/domain/commissions';
import { reviewForCommission } from '@/lib/domain/reviews';
import { formatEuro } from '@/lib/money';
import { requirePageActor } from '@/lib/session';
import { Flat, initials, TINT } from '@/components/flat';
import { Back, Chat, Shield, Star } from '@/components/icons';
import { PhotoStrip } from '@/components/photos';
import { CommissionProgress } from '@/components/progress';
import {
  AbandonCheckout, AcceptQuoteButton, AlterationForm, CancelRequestButton, DisputeForm, ProposeCancelForm, ReceivedButton,
  RespondCancelButtons, ReviewForm
} from '@/components/commission-forms';

export async function generateMetadata() { return { title: (await getTranslations('requests'))('title'), robots: { index: false } }; }

export default async function RequestDetail({ params, searchParams }: PageProps<'/[locale]/requests/[id]'>) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const actor = await requirePageActor(locale, `/requests/${id}`, 'customer');
  const { request: r, photos, quotes, commission: c, target } = await getCustomerRequest(actor, id);
  const threads = (await listThreads(actor)).filter((x) => x.requestId === id);
  const review = c?.status === 'completed' ? await reviewForCommission(c.id) : null;
  const t = await getTranslations('requests');
  const tc = await getTranslations('commission');
  const ts = await getTranslations('status');
  const tg = await getTranslations('garment');
  const tm = await getTranslations('measure');
  const tw = await getTranslations('wizard');
  const td = await getTranslations('delivery');
  const tcom = await getTranslations('common');
  const th = await getTranslations('handover');
  const f = await getFormatter();
  const eur = (cents: number) => formatEuro(cents, locale);
  const date = (d: string | Date) => f.dateTime(typeof d === 'string' ? new Date(`${d}T12:00:00`) : d, { day: 'numeric', month: 'long', year: 'numeric' });
  const maker = c ? quotes.find((q) => q.id === c.quoteId)?.student : null;
  const makerFirst = maker?.name.split(' ')[0] ?? '';
  const questions = threads.filter((th) => !quotes.some((q) => q.student.id === th.studentId));
  const threadOf = (sid: string) => threads.find((x) => x.studentId === sid);
  const ms = Object.entries(r.measurements);
  const readyBy = c ? quotes.find((q) => q.id === c.quoteId)?.readyBy : null;
  const overdue = overdueForReport(readyBy);

  return (
    <div className="wrap flex flex-col gap-8 py-10">
      {sp.checkout === 'cancelled' && typeof sp.commission === 'string' && <AbandonCheckout commissionId={sp.commission} />}
      {sp.paid && c?.status === 'pending_payment' && <div className="notice notice-sand" role="status">{t('processing')}</div>}
      {sp.paid && c?.status === 'making' && <div className="notice notice-sage" role="status">{t('paidToast')}</div>}
      <Link href="/requests" className="inline-flex items-center gap-2 text-[14px] text-muted no-underline"><Back /> {t('back')}</Link>

      <section className="flex flex-wrap items-start gap-8">
        <div className={`arch ${TINT[r.garment]} h-[260px] flex-[0_0_200px]`}><Flat garment={r.garment} width={110} height={150} label={tg(r.garment)} /></div>
        <div className="flex flex-[1_1_420px] flex-col gap-4">
          <div className="flex flex-wrap gap-2"><span className={`badge ${r.status === 'open' ? 'badge-clay' : r.status === 'accepted' ? 'badge-sage' : 'badge-sand'}`}>{ts(r.status)}</span>
            {target && <span className="tag">{t('sentOnlyTo', { name: target.name })}</span>}</div>
          <h1 className="h1 !text-[clamp(36px,4.4vw,58px)]">{r.title}</h1>
          <p className="max-w-[640px] whitespace-pre-line text-ink-soft">{r.description}</p>
          <PhotoStrip photos={photos} />
          <dl className="kv text-[15px]">
            <dt>{tw('rPiece')}</dt><dd>{tg(r.garment)}{r.purpose ? ` · ${r.purpose}` : ''}</dd>
            <dt>{tw('rMeasurements')}</dt><dd>{r.measureInPerson && !ms.length ? tw('rMeasureInPerson') : ms.map(([k, v]) => `${tm.has(k) ? tm(k) : k} ${v} cm`).join(' · ')}</dd>
            <dt>{tw('rFabric')}</dt><dd>{tw(r.fabric === 'own' ? 'fabricOwn' : 'fabricSource')}</dd>
            <dt>{tw('rBudget')}</dt><dd>{r.budgetCents != null ? eur(r.budgetCents) : tw('rOpen')}</dd>
            <dt>{tw('rNeededBy')}</dt><dd>{r.neededBy ? date(r.neededBy) : tw('rFlexible')}</dd>
            <dt>{tw('rDelivery')}</dt><dd>{td(r.delivery)}{r.city ? ` · ${r.city}` : ''}</dd>
          </dl>
          {r.status === 'open' && !c && <div><CancelRequestButton id={r.id} /></div>}
        </div>
      </section>

      {c && c.status !== 'pending_payment' && maker && (
        <section className="card flex flex-col gap-5" aria-labelledby="commission-h">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1"><span className="eyebrow">{tc('eyebrow')}</span>
              <h2 id="commission-h" className="h3">{tc('madeBy')} <Link href={`/makers/${maker.slug}`}>{maker.name}</Link></h2></div>
            <div className="text-right"><span className="font-serif text-[30px]">{eur(c.totalCents)}</span></div>
          </div>
          {c.status !== 'cancelled' && <CommissionProgress status={c.status} handover={c.handover} />}
          <div className={`notice ${c.status === 'sent' ? 'notice-clay' : c.status === 'completed' ? 'notice-sage' : 'notice-sand'}`}><Shield /><span>
            {c.status === 'making' && tc('heldMaking', { total: eur(c.totalCents), name: makerFirst })}
            {c.status === 'sent' && tc('heldSent', { name: makerFirst, how: c.handover, total: eur(c.totalCents), date: c.sentAt ? date(releaseDate(c.sentAt)) : '' })}
            {c.status === 'altering' && tc('heldAltering', { name: makerFirst, note: c.alterationNote, total: eur(c.totalCents) })}
            {c.status === 'disputed' && tc('disputed')}
            {c.status === 'completed' && (c.completedBy === 'customer' ? tc('completedByCustomer', { payout: eur(c.totalCents - c.refundedCents), name: makerFirst })
              : c.completedBy === 'auto' ? tc('completedAuto', { name: makerFirst }) : tc('completedAdmin', { refund: eur(c.refundedCents) }))}
            {c.status === 'cancelled' && tc('cancelledNotice', { refund: eur(c.refundedCents) })}
          </span></div>
          {c.trackingUrl && c.status === 'sent' && <a className="text-link w-fit" href={c.trackingUrl} target="_blank" rel="noopener noreferrer">{tc('tracking')} ↗</a>}
          {c.cancelProposedBy && c.status === 'making' && (
            <div className="notice notice-sand flex-col">
              {c.cancelProposedBy === actor.id
                ? <span>{tc('proposalFromYou', { refund: eur(c.cancelRefundCents ?? 0) })}</span>
                : <><span>{tc('proposalFromOther', { name: makerFirst, refund: eur(c.cancelRefundCents ?? 0), reason: c.cancelReason })}</span><RespondCancelButtons id={c.id} /></>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {c.status === 'sent' && <ReceivedButton id={c.id} label={tc('received')} success={tc('receivedToast', { name: makerFirst })} confirm={tc('receivedConfirm', { total: eur(c.totalCents), name: makerFirst })} />}
            <Link className="btn btn-line" href={`/messages/${r.id}/${c.studentId}`}><Chat /> {t('messageName', { name: makerFirst })}</Link>
            {['making', 'sent', 'altering'].includes(c.status) && <span className="text-[13px] text-muted">{c.alterationIncluded ? (c.alterationUsed ? tc('alterationUsed') : tc('alterationIncluded')) : tc('noAlteration')}</span>}
          </div>
          {c.status === 'sent' && c.alterationIncluded && !c.alterationUsed && <AlterationForm id={c.id} />}
          {(['sent', 'altering'].includes(c.status) || (c.status === 'making' && overdue)) && <DisputeForm id={c.id} />}
          {c.status === 'making' && !c.cancelProposedBy && <ProposeCancelForm id={c.id} max={c.totalCents} totalLabel={eur(c.totalCents)} />}
          {c.status === 'completed' && (review
            ? <div className="rounded-[20px] bg-linen p-4"><span className="label">{tc('yourReview')}</span><div className="mt-1 flex gap-0.5 text-clay">{[1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= review.rating} />)}</div>{review.body && <p className="mt-2 text-ink-soft">{review.body}</p>}</div>
            : <div className="border-t border-dashed border-seam-strong pt-4"><ReviewForm id={c.id} /></div>)}
        </section>
      )}

      {questions.length > 0 && (
        <section className="flex flex-col gap-3"><h2 className="h3">{t('questions')}</h2>
          {questions.map((x) => (
            <Link key={x.studentId} className="list-row" href={`/messages/${r.id}/${x.studentId}`}>
              <span className="avatar tint-clay">{initials(x.with)}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="h4 text-[16px]">{x.with}</span><span className="truncate text-[13px] text-muted">{x.last?.body}</span></span>
              {x.unread ? <span className="count count-clay">{x.unread}</span> : <span className="text-link text-[14px]">{t('reply')}</span>}
            </Link>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="quotes-h">
        <h2 id="quotes-h" className="h3">{t('quotes')} {quotes.length > 0 && <span className="text-muted">({quotes.length})</span>}</h2>
        {r.status === 'open' && target && !quotes.length && !threads.length && (
          <div><Link className="btn btn-line btn-sm" href={`/messages/${r.id}/${r.targetStudentId}`}><Chat /> {t('messageName', { name: target.name.split(' ')[0] })}</Link></div>
        )}
        {quotes.length ? quotes.map((q) => (
          <article key={q.id} className={`card flex flex-wrap gap-6 ${q.status === 'declined' || q.status === 'withdrawn' ? 'opacity-60' : ''}`}>
            <div className="flex min-w-0 flex-[1_1_280px] gap-4">
              <span className="avatar tint-sage">{initials(q.student.name)}</span>
              <div className="flex flex-col gap-1">
                <Link className="h4 text-[18px]" href={`/makers/${q.student.slug}`}>{q.student.name}</Link>
                <span className="inline-flex items-center gap-1 text-[13px] text-muted">{q.student.verified && <><Shield size={14} />{tcom('verifiedStudent')} · </>}{[q.student.programme, q.student.school].filter(Boolean).join(', ')}</span>
                {q.message && <p className="mt-1.5 whitespace-pre-line text-[15px] text-ink-soft">“{q.message}”</p>}
              </div>
            </div>
            <div className="flex min-w-[190px] flex-col gap-1">
              <span className="font-serif text-[30px]">{eur(q.totalCents)}</span>
              <span className="text-[13px] text-muted">{t('making', { amount: eur(q.labourCents) })}{q.fabricCents ? ` + ${t('fabricLine', { amount: eur(q.fabricCents) })}` : ''}{q.shippingCents ? ` + ${t('shippingLine', { amount: eur(q.shippingCents) })}` : ''}</span>
              {q.readyBy && <span className="text-[13px] text-muted">{t('readyBy', { date: date(q.readyBy) })}</span>}
              <span className="mt-1 flex flex-wrap gap-1.5"><span className="tag">{q.handover === 'shipping' ? th('shippingLong') : th('inPersonLong')}</span>
                <span className="tag">{q.alteration ? t('alterationIncluded') : t('noAlteration')}</span></span>
            </div>
            <div className="flex flex-col items-start gap-2">
              {q.status === 'pending' && r.status === 'open'
                ? <AcceptQuoteButton quoteId={q.id} label={t('accept', { total: eur(q.totalCents) })}
                  confirm={t('acceptConfirm', { name: q.student.name, total: eur(q.totalCents), first: q.student.name.split(' ')[0] })} />
                : <span className={`badge ${q.status === 'accepted' ? 'badge-sage' : 'badge-sand'}`}>{q.status === 'accepted' ? t('accepted') : t('notChosen')}</span>}
              {(q.status === 'pending' || q.status === 'accepted' || threadOf(q.student.id)?.last) && (
                <Link className="btn btn-ghost btn-sm" href={`/messages/${r.id}/${q.student.id}`}><Chat /> {t('message')}{threadOf(q.student.id)?.unread ? <span className="count count-clay">{threadOf(q.student.id)!.unread}</span> : null}</Link>
              )}
            </div>
          </article>
        )) : <div className="empty">{r.status === 'open' ? t('noQuotesOpen') : t('noQuotes')}</div>}
      </section>
    </div>
  );
}
