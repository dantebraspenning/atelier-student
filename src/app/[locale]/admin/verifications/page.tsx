import { getTranslations } from 'next-intl/server';
import { pendingVerifications } from '@/lib/domain/admin';
import { requirePageActor } from '@/lib/session';
import { PhotoStrip } from '@/components/photos';
import { VerificationDecision } from '@/components/admin-forms';

export default async function AdminVerifications({ params }: PageProps<'/[locale]/admin/verifications'>) {
  const { locale } = await params;
  const rows = await pendingVerifications(await requirePageActor(locale, '/admin', 'admin'));
  const t = await getTranslations('admin');
  if (!rows.length) return <div className="empty">{t('nothing')}</div>;
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <article key={r.v.id} className="card flex flex-wrap gap-6">
          <div className="flex flex-[1_1_280px] flex-col gap-1"><span className="h4">{r.name}</span><span className="text-[14px] text-muted">{r.email}</span>
            <span className="text-[14px] text-ink-soft">{[r.school, r.programme].filter(Boolean).join(' · ')}</span>{r.v.note && <p className="text-[14px]">“{r.v.note}”</p>}</div>
          <PhotoStrip photos={r.photos} size={140} />
          <div className="flex-[1_1_260px]"><VerificationDecision id={r.v.id} /></div>
        </article>
      ))}
    </div>
  );
}
