'use client';

import { createContext, useActionState, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { ActionResult } from '@/lib/errors';

// ─────────────── toasts ───────────────

const ToastContext = createContext<(msg: string) => void>(() => {});
const FLASH_KEY = 'atelier-flash';

/** Show a toast after a full navigation (e.g. returning from a redirect). */
export function flash(msg: string) {
  try { sessionStorage.setItem(FLASH_KEY, msg); } catch { /* private mode */ }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3600);
  }, []);
  useEffect(() => {
    // Read the flash message set before a full navigation (scheduled, so the toast renders after hydration).
    const id = setTimeout(() => {
      try {
        const f = sessionStorage.getItem(FLASH_KEY);
        if (f) { sessionStorage.removeItem(FLASH_KEY); show(f); }
      } catch { /* private mode */ }
    }, 0);
    return () => clearTimeout(id);
  }, [show]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {msg && <div role="status" className="pointer-events-auto rounded-full bg-ink px-6 py-3 text-[15px] text-linen shadow-lg">{msg}</div>}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ─────────────── errors ───────────────

export function ErrorMessage({ result }: { result: ActionResult<unknown> | null | undefined }) {
  const t = useTranslations('errors');
  if (!result || result.ok) return null;
  const key = t.has(result.error) ? result.error : 'unexpected';
  return <div role="alert" className="form-error">{t(key, result.values ?? {})}</div>;
}

// ─────────────── buttons ───────────────

export function SubmitButton({ children, className = 'btn btn-sage', confirm, disabled, name, value }: {
  children: ReactNode; className?: string; confirm?: string; disabled?: boolean; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending || disabled} aria-busy={pending}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

// ─────────────── forms ───────────────

type Action<T> = (prev: ActionResult<T> | null, form: FormData) => Promise<ActionResult<T>>;

/**
 * A form bound to a server action. Shows the translated error inline, a toast on success,
 * then refreshes the page data, follows `data.redirect`, or calls `onDone`.
 */
export function ActionForm<T>({ action, children, success, className, refresh = true, onDone, resetOnSuccess = false, id }: {
  action: Action<T>; children: ReactNode; success?: string; className?: string; refresh?: boolean;
  onDone?: (data: T | undefined) => void; resetOnSuccess?: boolean; id?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const toast = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<ActionResult<T> | null>(null);
  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (!state.ok) return;
    const data = state.data as (T & { redirect?: string }) | undefined;
    if (data && typeof data === 'object' && 'redirect' in data && data.redirect) {
      if (success) flash(success);
      window.location.assign(data.redirect);
      return;
    }
    if (success) toast(success);
    if (resetOnSuccess) formRef.current?.reset();
    onDone?.(state.data);
    if (refresh) router.refresh();
  }, [state, success, toast, router, refresh, onDone, resetOnSuccess]);
  return (
    <form ref={formRef} action={formAction} className={className} id={id} noValidate>
      {children}
      <ErrorMessage result={state} />
    </form>
  );
}
