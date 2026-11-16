'use client';

import { useLocale, useTranslations } from 'next-intl';
import { reportAction } from '@/app/actions/marketplace';
import { ActionForm, SubmitButton } from './forms';
import { Flag } from './icons';

const REASONS = ['spam', 'harassment', 'inappropriate', 'scam', 'off_platform_payment', 'other'] as const;

/** DSA notice-and-action: a small "Report" disclosure next to people and content. */
export function ReportButton({ targetType, targetId }: { targetType: 'user' | 'message' | 'photo' | 'portfolio' | 'review' | 'request'; targetId: string }) {
  const t = useTranslations('report');
  const locale = useLocale();
  return (
    <details className="relative">
      <summary className="inline-flex min-h-8 items-center gap-1.5 text-[13px] text-muted hover:text-ink"><Flag />{t('title')}</summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-3xl border border-seam bg-cotton p-5 shadow-lg">
        <ActionForm action={reportAction} success={t('thanks')} refresh={false} resetOnSuccess className="flex flex-col gap-3">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="locale" value={locale} />
          <label className="field"><span className="label">{t('reason')}</span>
            <select name="reason" className="select" required>{REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}</select>
          </label>
          <label className="field"><span className="label">{t('details')}</span><textarea name="details" maxLength={2000} className="textarea !min-h-20" /></label>
          <SubmitButton className="btn btn-ink btn-sm">{t('submit')}</SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}
