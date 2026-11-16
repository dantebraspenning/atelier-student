'use server';

import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { fail, runAction } from '@/lib/errors';
import { bool, localeOf, str } from '@/lib/request-meta';
import { requireActor } from '@/lib/session';
import { deleteAccount, updateSettings } from '@/lib/domain/account';

export async function settingsAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const actor = await requireActor();
    const locale = str(fd, 'language') === 'en' ? 'en' : 'nl';
    await updateSettings(actor, { name: str(fd, 'name'), locale, notifyMessages: bool(fd, 'notifyMessages') });
    if (locale !== localeOf(fd)) return { redirect: `/${locale}/account` };
  });
}

export async function deleteAccountAction(_: unknown, fd: FormData) {
  return runAction(async () => {
    const actor = await requireActor();
    if (!['DELETE', 'VERWIJDER'].includes(str(fd, 'confirm').toUpperCase())) fail('confirmDelete');
    await deleteAccount(actor);
    const a = await getAuth();
    await a.api.signOut({ headers: await headers() }).catch(() => undefined);
    return { redirect: `/${localeOf(fd)}?deleted=1` };
  });
}
