import { redirect } from 'next/navigation';
import { getActor, homeFor } from '@/lib/session';
import { safeNext } from '@/lib/request-meta';

/** Landing spot after clicking the email-verification link: send people where they belong. */
export default async function Welcome({ params, searchParams }: PageProps<'/[locale]/welcome'>) {
  const { locale } = await params;
  const sp = await searchParams;
  const actor = await getActor();
  if (!actor) redirect(`/${locale}/sign-in`);
  redirect(safeNext(typeof sp.next === 'string' ? sp.next : null, locale, actor.role === 'student' ? '/studio/setup' : homeFor(actor.role)));
}
