import { getTranslations } from 'next-intl/server';

export default async function AdminDac7() {
  const t = await getTranslations('admin');
  const year = new Date().getUTCFullYear();
  return (
    <form action="/api/admin/dac7" method="get" className="card flex max-w-[640px] flex-col gap-4">
      <h2 className="h3">{t('nav.dac7')}</h2>
      <p className="text-ink-soft">{t('dac7Lead')}</p>
      <label className="field max-w-[160px]"><span className="label">{t('year')}</span>
        <select name="year" className="select" defaultValue={year - 1}>{[year, year - 1, year - 2].map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
      <div><button className="btn btn-ink">{t('download')}</button></div>
    </form>
  );
}
