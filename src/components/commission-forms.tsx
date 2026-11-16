'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  abandonCheckoutAction, acceptQuoteAction, alterationAction, cancelRequestAction, confirmReceivedAction, disputeAction,
  markSentAction, proposeCancelAction, respondCancelAction, reviewAction, studentCancelAction
} from '@/app/actions/marketplace';
import { ActionForm, SubmitButton, useToast } from './forms';
import { Check, Star } from './icons';

const Locale = () => <input type="hidden" name="locale" value={useLocale()} />;

export function AcceptQuoteButton({ quoteId, label, confirm }: { quoteId: string; label: string; confirm: string }) {
  return (
    <ActionForm action={acceptQuoteAction}>
      <input type="hidden" name="quoteId" value={quoteId} /><Locale />
      <SubmitButton className="btn btn-sage" confirm={confirm}>{label}</SubmitButton>
    </ActionForm>
  );
}

export function CancelRequestButton({ id }: { id: string }) {
  const t = useTranslations('requests');
  return (
    <ActionForm action={cancelRequestAction} success={t('cancelled')}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-ghost btn-sm" confirm={t('cancelConfirm')}>{t('cancel')}</SubmitButton>
    </ActionForm>
  );
}

/** Returning from an abandoned Stripe checkout: release the pending attempt so the customer can choose again. */
export function AbandonCheckout({ commissionId }: { commissionId: string }) {
  const t = useTranslations('requests');
  const toast = useToast();
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void abandonCheckoutAction(commissionId).then(() => { toast(t('checkoutCancelled')); router.replace(window.location.pathname.replace(/^\/(nl|en)/, '')); });
  }, [commissionId, router, t, toast]);
  return null;
}

export function ReceivedButton({ id, confirm, label, success }: { id: string; confirm: string; label: string; success: string }) {
  return (
    <ActionForm action={confirmReceivedAction} success={success}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-sage" confirm={confirm}><Check /> {label}</SubmitButton>
    </ActionForm>
  );
}

export function AlterationForm({ id }: { id: string }) {
  const t = useTranslations('commission');
  return (
    <details className="border-t border-dashed border-seam-strong pt-4">
      <summary className="font-medium text-clay-deep">{t('alterationSummary')}</summary>
      <ActionForm action={alterationAction} success={t('alterationToast')} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="field"><span className="label">{t('alterationLabel')}</span>
          <textarea name="note" className="textarea !min-h-24" maxLength={1000} minLength={5} required placeholder={t('alterationPlaceholder')} /></label>
        <span className="hint">{t('alterationHint')}</span>
        <div><SubmitButton className="btn btn-ink btn-sm">{t('alterationSubmit')}</SubmitButton></div>
      </ActionForm>
    </details>
  );
}

export function DisputeForm({ id }: { id: string }) {
  const t = useTranslations('commission');
  const reasons = ['not_received', 'not_as_agreed', 'poor_quality', 'damaged', 'other'] as const;
  return (
    <details className="border-t border-dashed border-seam-strong pt-4">
      <summary className="font-medium text-ink-soft">{t('problemSummary')}</summary>
      <ActionForm action={disputeAction} success={t('problemToast')} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="field"><span className="label">{t('problemReason')}</span>
          <select name="reason" className="select">{reasons.map((r) => <option key={r} value={r}>{t(`problemReasons.${r}`)}</option>)}</select></label>
        <label className="field"><span className="label">{t('problemDetails')}</span><textarea name="details" className="textarea" minLength={20} maxLength={3000} required /></label>
        <span className="hint">{t('problemHint')}</span>
        <div><SubmitButton className="btn btn-danger btn-sm">{t('problemSubmit')}</SubmitButton></div>
      </ActionForm>
    </details>
  );
}

export function ProposeCancelForm({ id, totalLabel, max }: { id: string; totalLabel: string; max: number }) {
  const t = useTranslations('commission');
  return (
    <details className="border-t border-dashed border-seam-strong pt-4">
      <summary className="font-medium text-ink-soft">{t('cancelSummary')}</summary>
      <ActionForm action={proposeCancelAction} success={t('cancelProposedToast')} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="field max-w-xs"><span className="label">{t('cancelRefund')}</span>
          <span className="affix"><span>€</span><input name="refund" inputMode="decimal" defaultValue={(max / 100).toFixed(2)} aria-describedby="refund-hint" /></span>
          <span id="refund-hint" className="hint">{t('cancelRefundHint')} (max {totalLabel})</span></label>
        <label className="field"><span className="label">{t('cancelReason')}</span><textarea name="reason" className="textarea !min-h-20" minLength={5} maxLength={500} required /></label>
        <div><SubmitButton className="btn btn-ghost btn-sm">{t('cancelPropose')}</SubmitButton></div>
      </ActionForm>
    </details>
  );
}

export function RespondCancelButtons({ id }: { id: string }) {
  const t = useTranslations('commission');
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={respondCancelAction} success={t('cancelledToast')}><input type="hidden" name="id" value={id} /><input type="hidden" name="answer" value="accept" />
        <SubmitButton className="btn btn-ink btn-sm">{t('acceptProposal')}</SubmitButton></ActionForm>
      <ActionForm action={respondCancelAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="answer" value="decline" />
        <SubmitButton className="btn btn-ghost btn-sm">{t('declineProposal')}</SubmitButton></ActionForm>
    </div>
  );
}

export function StudentCancelForm({ id }: { id: string }) {
  const t = useTranslations('commission');
  return (
    <details className="border-t border-dashed border-seam-strong pt-3">
      <summary className="text-[14px] text-muted">{t('studentCancel')}</summary>
      <ActionForm action={studentCancelAction} success={t('cancelledToast')} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="field"><span className="label">{t('cancelReason')}</span><textarea name="reason" className="textarea !min-h-20" minLength={5} maxLength={500} required /></label>
        <div><SubmitButton className="btn btn-danger btn-sm" confirm={t('studentCancelConfirm')}>{t('studentCancel')}</SubmitButton></div>
      </ActionForm>
    </details>
  );
}

export function MarkSentForm({ id, handover }: { id: string; handover: 'in_person' | 'shipping' }) {
  const t = useTranslations('studio');
  return (
    <ActionForm action={markSentAction} success={t('markedSent')} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={id} />
      {handover === 'shipping' && <label className="field min-w-[220px] flex-1"><span className="label">{t('trackingLabel')}</span><input name="tracking" type="url" className="input" placeholder="https://" /></label>}
      <SubmitButton className="btn btn-ink btn-sm">{handover === 'shipping' ? t('markShipped') : t('markHandedOver')}</SubmitButton>
    </ActionForm>
  );
}

export function ReviewForm({ id }: { id: string }) {
  const t = useTranslations('commission');
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={reviewAction} success={t('reviewThanks')} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="rating" value={rating} />
      <span className="h4">{t('reviewTitle')}</span>
      <div role="radiogroup" aria-label={t('reviewTitle')} className="flex gap-1 text-clay">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)} className="grid size-10 place-items-center rounded-full hover:bg-clay-mist">
            <Star size={24} filled={n <= rating} />
          </button>
        ))}
      </div>
      <label className="field"><span className="label">{t('reviewLabel')}</span><textarea name="body" className="textarea !min-h-24" maxLength={2000} placeholder={t('reviewPlaceholder')} /></label>
      <div><SubmitButton className="btn btn-sage btn-sm" disabled={!rating}>{t('reviewSubmit')}</SubmitButton></div>
    </ActionForm>
  );
}
