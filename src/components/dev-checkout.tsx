'use client';

import { useLocale } from 'next-intl';
import { simulatePaymentAction } from '@/app/actions/marketplace';
import { ActionForm, SubmitButton } from './forms';

export function DevPayButton({ commissionId, requestId, label }: { commissionId: string; requestId: string; label: string }) {
  return (
    <ActionForm action={simulatePaymentAction}>
      <input type="hidden" name="commissionId" value={commissionId} /><input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="locale" value={useLocale()} />
      <SubmitButton className="btn btn-sage btn-lg w-full">{label}</SubmitButton>
    </ActionForm>
  );
}
