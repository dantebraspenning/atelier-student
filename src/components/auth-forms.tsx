'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { forgotPasswordAction, resendVerificationAction, resetPasswordAction, signInAction, signUpAction } from '@/app/actions/auth';
import { ActionForm, SubmitButton } from './forms';

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="input" {...props} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
    </div>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  return (
    <ActionForm action={signInAction} className="card card-lg flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ''} />
      <Field id="email" name="email" type="email" label={t('email')} autoComplete="email" required />
      <Field id="password" name="password" type="password" label={t('password')} autoComplete="current-password" required />
      <SubmitButton className="btn btn-sage btn-lg">{t('submitSignIn')}</SubmitButton>
      <div className="flex flex-wrap justify-between gap-3 text-[14px] text-muted">
        <Link href="/forgot-password">{t('forgot')}</Link>
        <span>{t.rich('noAccount', { link: (c) => <Link href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ''}`}>{c}</Link> })}</span>
      </div>
    </ActionForm>
  );
}

export function SignUpForm({ role, next }: { role: 'customer' | 'student'; next?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const q = next ? `&next=${encodeURIComponent(next)}` : '';
  return (
    <ActionForm action={signUpAction} className="card card-lg flex flex-col gap-5">
      <nav className="tabs" aria-label={t('submitSignUp')}>
        <Link className="tab" href={`/sign-up?role=customer${q}`} aria-current={role === 'customer' ? 'page' : undefined}>{t('roleCustomer')}</Link>
        <Link className="tab" href={`/sign-up?role=student${q}`} aria-current={role === 'student' ? 'page' : undefined}>{t('roleStudent')}</Link>
      </nav>
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ''} />
      <Field id="name" name="name" label={t('name')} autoComplete="name" required maxLength={80} />
      <Field id="email" name="email" type="email" label={t('email')} autoComplete="email" required />
      <Field id="password" name="password" type="password" label={t('password')} hint={t('passwordHint')} autoComplete="new-password" required minLength={10} />
      <SubmitButton className="btn btn-sage btn-lg">{t('submitSignUp')}</SubmitButton>
      <p className="text-[13px] text-muted">{t.rich('terms', { terms: (c) => <Link href="/legal/terms">{c}</Link>, privacy: (c) => <Link href="/legal/privacy">{c}</Link> })}</p>
      <p className="text-[14px] text-muted">{t.rich('haveAccount', { link: (c) => <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`}>{c}</Link> })}</p>
    </ActionForm>
  );
}

export function ResendForm({ email }: { email: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  return (
    <ActionForm action={resendVerificationAction} success={t('resent')} refresh={false}>
      <input type="hidden" name="email" value={email} /><input type="hidden" name="locale" value={locale} />
      <SubmitButton className="btn btn-ghost">{t('resend')}</SubmitButton>
    </ActionForm>
  );
}

export function ForgotForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  return (
    <ActionForm action={forgotPasswordAction} success={t('forgotSent')} refresh={false} resetOnSuccess className="card card-lg flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <Field id="email" name="email" type="email" label={t('email')} autoComplete="email" required />
      <SubmitButton className="btn btn-sage btn-lg">{t('forgotSubmit')}</SubmitButton>
    </ActionForm>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  return (
    <ActionForm action={resetPasswordAction} success={t('resetDone')} className="card card-lg flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="token" value={token} />
      <Field id="password" name="password" type="password" label={t('newPassword')} hint={t('passwordHint')} autoComplete="new-password" required minLength={10} />
      <SubmitButton className="btn btn-sage btn-lg">{t('resetSubmit')}</SubmitButton>
    </ActionForm>
  );
}
