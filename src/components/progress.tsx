import { getTranslations } from 'next-intl/server';
import type { CommissionStatus, Handover } from '@/lib/db/schema';

export async function CommissionProgress({ status, handover }: { status: CommissionStatus; handover: Handover }) {
  const t = await getTranslations('commission.steps');
  const steps = [t('accepted'), status === 'altering' ? t('altering') : t('making'), handover === 'shipping' ? t('shipped') : t('handedOver'), t('received')];
  const idx = { pending_payment: 0, making: 1, altering: 1, sent: 2, disputed: 2, completed: 4, cancelled: 4 }[status];
  return (
    <div className="flex flex-col gap-2" aria-label={steps.join(' → ')}>
      <div className="progress">{steps.map((s, i) => <span key={s} className={i < idx ? 'on' : i === idx ? 'now' : ''} />)}</div>
      <div className="flex justify-between text-[12px] text-muted">{steps.map((s) => <span key={s}>{s}</span>)}</div>
    </div>
  );
}
