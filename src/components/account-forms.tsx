'use client';

import { useLocale, useTranslations } from 'next-intl';
import { changePasswordAction } from '@/app/actions/auth';
import { deleteAccountAction, settingsAction } from '@/app/actions/account';
import { markNotificationsReadAction } from '@/app/actions/marketplace';
import { acceptingAction } from '@/app/actions/studio';
import { useRouter } from '@/i18n/navigation';
import { ActionForm, SubmitButton, useToast } from './forms';
import { useTransition } from 'react';

export function SettingsForm({ name, language, notifyMessages }: { name: string; language: 'nl' | 'en'; notifyMessages: boolean }) {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  return (
    <ActionForm action={settingsAction} success={t('settingsSaved')} className="card flex flex-col gap-5">
      <h2 className="h3">{t('settings')}</h2>
      <input type="hidden" name="locale" value={useLocale()} />
      <label className="field"><span className="label">{t('name')}</span><input name="name" className="input" defaultValue={name} maxLength={80} required autoComplete="name" /></label>
      <label className="field max-w-xs"><span className="label">{t('language')}</span>
        <select name="language" className="select" defaultValue={language}><option value="nl">Nederlands</option><option value="en">English</option></select></label>
      <label className="check"><input type="checkbox" name="notifyMessages" defaultChecked={notifyMessages} /><span>{t('notifyMessages')}</span></label>
      <div><SubmitButton>{tc('save')}</SubmitButton></div>
    </ActionForm>
  );
}

export function PasswordForm() {
  const t = useTranslations('account');
  const ta = useTranslations('auth');
  return (
    <ActionForm action={changePasswordAction} success={t('passwordChanged')} resetOnSuccess className="card flex flex-col gap-5">
      <h2 className="h3">{t('passwordTitle')}</h2>
      <label className="field"><span className="label">{t('currentPassword')}</span><input name="current" type="password" className="input" autoComplete="current-password" required /></label>
      <label className="field"><span className="label">{ta('newPassword')}</span><input name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
        <span className="hint">{ta('passwordHint')}</span></label>
      <div><SubmitButton>{t('passwordTitle')}</SubmitButton></div>
    </ActionForm>
  );
}

export function DeleteAccountForm() {
  const t = useTranslations('account');
  return (
    <ActionForm action={deleteAccountAction} success={t('deleted')} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={useLocale()} />
      <label className="field max-w-xs"><span className="label">{t('deleteConfirm')}</span><input name="confirm" className="input" autoComplete="off" required /></label>
      <div><SubmitButton className="btn btn-danger">{t('deleteButton')}</SubmitButton></div>
    </ActionForm>
  );
}

export function MarkAllRead() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })}>{t('markAllRead')}</button>;
}

export function AcceptingSwitch({ accepting }: { accepting: boolean }) {
  const t = useTranslations('studio');
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 rounded-full border border-seam bg-cotton py-2 pl-5 pr-2.5">
      <span className="flex flex-col leading-tight"><span id="avail" className="text-[15px] font-medium">{accepting ? t('accepting') : t('paused')}</span>
        <span className="text-[12px] text-muted">{accepting ? t('acceptingHint') : t('pausedHint')}</span></span>
      <button type="button" role="switch" aria-checked={accepting} aria-labelledby="avail" className="switch" disabled={pending}
        onClick={() => start(async () => { const r = await acceptingAction(!accepting); if (r.ok) { toast(!accepting ? t('accepting') : t('paused')); router.refresh(); } })} />
    </div>
  );
}
