'use client';

import { useTranslations } from 'next-intl';
import { handleReportAction, resolveDisputeAction, reviewVerificationAction, suspendAction } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from './forms';

export function VerificationDecision({ id }: { id: string }) {
  const t = useTranslations('admin');
  return (
    <ActionForm action={reviewVerificationAction} success={t('done')} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="field"><span className="label">{t('note')}</span><input name="note" className="input" maxLength={500} /></label>
      <div className="flex gap-2"><SubmitButton name="decision" value="approve" className="btn btn-sage btn-sm">{t('approve')}</SubmitButton>
        <SubmitButton name="decision" value="reject" className="btn btn-danger btn-sm">{t('reject')}</SubmitButton></div>
    </ActionForm>
  );
}

export function DisputeResolution({ id }: { id: string }) {
  const t = useTranslations('admin');
  return (
    <ActionForm action={resolveDisputeAction} success={t('done')} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="field max-w-xs"><span className="label">{t('refundAmount')}</span><input name="refund" inputMode="decimal" className="input" /></label>
      <label className="field"><span className="label">{t('resolutionNote')}</span><textarea name="note" className="textarea !min-h-20" maxLength={2000} /></label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="resolution" value="release" className="btn btn-sage btn-sm">{t('release')}</SubmitButton>
        <SubmitButton name="resolution" value="split" className="btn btn-ghost btn-sm">{t('split')}</SubmitButton>
        <SubmitButton name="resolution" value="refund" className="btn btn-danger btn-sm">{t('refund')}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ReportDecision({ id, isUser }: { id: string; isUser: boolean }) {
  const t = useTranslations('admin');
  return (
    <ActionForm action={handleReportAction} success={t('done')} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="note" className="input" maxLength={500} placeholder={t('note')} aria-label={t('note')} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="outcome" value="dismissed" className="btn btn-ghost btn-sm">{t('dismiss')}</SubmitButton>
        {isUser ? <SubmitButton name="outcome" value="suspend" className="btn btn-danger btn-sm">{t('suspend')}</SubmitButton>
          : <SubmitButton name="outcome" value="hide" className="btn btn-danger btn-sm">{t('hide')}</SubmitButton>}
      </div>
    </ActionForm>
  );
}

export function SuspendToggle({ id, suspended }: { id: string; suspended: boolean }) {
  const t = useTranslations('admin');
  return (
    <ActionForm action={suspendAction} success={t('done')}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="on" value={suspended ? '0' : '1'} />
      <SubmitButton className={`btn btn-sm ${suspended ? 'btn-ghost' : 'btn-danger'}`}>{suspended ? t('unsuspend') : t('suspend')}</SubmitButton>
    </ActionForm>
  );
}
