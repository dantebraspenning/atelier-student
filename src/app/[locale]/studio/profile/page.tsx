import { getOwnProfile } from '@/lib/domain/students';
import { requirePageActor } from '@/lib/session';
import { ProfileForm } from '@/components/studio-forms';

export default async function StudioProfile({ params }: PageProps<'/[locale]/studio/profile'>) {
  const { locale } = await params;
  const actor = await requirePageActor(locale, '/studio/profile', 'student');
  const p = await getOwnProfile(actor.id);
  return <ProfileForm name={actor.name} p={p} />;
}
