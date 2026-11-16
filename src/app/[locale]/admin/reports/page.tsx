import { getFormatter, getTranslations } from 'next-intl/server';
import { openReports } from '@/lib/domain/admin';
import { requirePageActor } from '@/lib/session';
import { ReportDecision } from '@/components/admin-forms';

export default async function AdminReports({ params }: PageProps<'/[locale]/admin/reports'>) {
  const { locale } = await params;
  const rows = await openReports(await requirePageActor(locale, '/admin', 'admin'));
  const t = await getTranslations('admin');
  const tr = await getTranslations('report');
  const f = await getFormatter();
  if (!rows.length) return <div className="empty">{t('nothing')}</div>;
  return (
    <div className="flex flex-col gap-4">
      {rows.map(({ r, reporter }) => (
        <article key={r.id} className="card flex flex-wrap gap-6">
          <div className="flex flex-[1_1_320px] flex-col gap-1">
            <span className="h4">{r.targetType} · {tr(`reasons.${r.reason}`)}</span>
            <span className="font-mono text-[12px] text-muted">{r.targetId}</span>
            <span className="text-[13px] text-muted">{reporter ?? '—'} · {f.relativeTime(r.createdAt)}</span>
            {r.details && <p className="text-[15px] text-ink-soft">{r.details}</p>}
          </div>
          <div className="flex-[1_1_280px]"><ReportDecision id={r.id} isUser={r.targetType === 'user'} /></div>
        </article>
      ))}
    </div>
  );
}
