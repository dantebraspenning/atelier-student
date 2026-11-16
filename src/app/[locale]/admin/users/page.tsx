import { getFormatter, getTranslations } from 'next-intl/server';
import { searchUsers } from '@/lib/domain/admin';
import { requirePageActor } from '@/lib/session';
import { SuspendToggle } from '@/components/admin-forms';

export default async function AdminUsers({ params, searchParams }: PageProps<'/[locale]/admin/users'>) {
  const { locale } = await params;
  const q = String((await searchParams).q ?? '');
  const admin = await requirePageActor(locale, '/admin', 'admin');
  const rows = await searchUsers(admin, q);
  const t = await getTranslations('admin');
  const f = await getFormatter();
  return (
    <div className="flex flex-col gap-4">
      <form className="flex max-w-md gap-2"><input name="q" defaultValue={q} className="input" placeholder={t('search')} aria-label={t('search')} /><button className="btn btn-ink">{t('search').split(' ')[0]}</button></form>
      <div className="overflow-x-auto rounded-[24px] border border-seam bg-cotton">
        <table className="w-full text-left text-[14px]">
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-seam last:border-0">
                <td className="p-3"><span className="font-medium">{u.name}</span><br /><span className="text-muted">{u.email}</span></td>
                <td className="p-3">{u.role}{!u.emailVerified && ' · unverified'}{u.deletedAt && ' · deleted'}</td>
                <td className="p-3 text-muted">{f.dateTime(u.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="p-3 text-right">{u.id !== admin.id && !u.deletedAt && <SuspendToggle id={u.id} suspended={!!u.suspendedAt} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
