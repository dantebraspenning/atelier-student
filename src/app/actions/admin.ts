'use server';

import { runAction } from '@/lib/errors';
import { parseEuros } from '@/lib/money';
import { str } from '@/lib/request-meta';
import { requireActor } from '@/lib/session';
import { handleReport, setSuspended } from '@/lib/domain/admin';
import { resolveDispute } from '@/lib/domain/commissions';
import { reviewVerification } from '@/lib/domain/students';

export async function reviewVerificationAction(_: unknown, fd: FormData) {
  return runAction(async () => reviewVerification(await requireActor('admin'), str(fd, 'id'), str(fd, 'decision') === 'approve', str(fd, 'note')));
}

export async function resolveDisputeAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const refund = parseEuros(str(fd, 'refund'));
    await resolveDispute(await requireActor('admin'), str(fd, 'id'), {
      resolution: str(fd, 'resolution') as never, refundCents: refund === null || Number.isNaN(refund) ? undefined : refund, note: str(fd, 'note')
    });
  });
}

export async function handleReportAction(_: unknown, fd: FormData) {
  return runAction(async () => handleReport(await requireActor('admin'), str(fd, 'id'), str(fd, 'outcome') as never, str(fd, 'note')));
}

export async function suspendAction(_: unknown, fd: FormData) {
  return runAction(async () => setSuspended(await requireActor('admin'), str(fd, 'id'), str(fd, 'on') === '1'));
}
