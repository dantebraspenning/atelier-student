import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getActor } from '@/lib/session';
import { getMakerBySlug } from '@/lib/domain/students';
import { RequestWizardLoader as RequestWizard } from '@/components/request-wizard-loader';

export async function generateMetadata() { return { title: (await getTranslations('wizard'))('title') }; }

export default async function RequestPage({ searchParams }: PageProps<'/[locale]/request'>) {
  const sp = await searchParams;
  const actor = await getActor();
  const t = await getTranslations('wizard');
  if (actor && actor.role !== 'customer') {
    return (
      <div className="wrap-narrow py-16"><div className="empty flex flex-col items-center gap-4">
        <h1 className="h2">{t('studentsOnly')}</h1><p>{t('studentsOnlyText')}</p>
        <Link className="btn btn-sage" href={actor.role === 'admin' ? '/admin' : '/studio'}>{t('goStudio')}</Link>
      </div></div>
    );
  }
  const slug = typeof sp.maker === 'string' ? sp.maker : '';
  const maker = slug ? await getMakerBySlug(slug) : null;
  const target = maker && maker.maker.accepting && maker.maker.payoutsEnabled ? { slug: maker.maker.slug, name: maker.maker.name } : null;
  return <RequestWizard signedIn={!!actor} initialGarment={typeof sp.garment === 'string' ? sp.garment : undefined} target={target} />;
}
