'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { sendMessageAction } from '@/app/actions/marketplace';
import type { ThreadMessage } from '@/lib/domain/messages';
import type { PhotoRef } from '@/lib/domain/photos';
import { formatEuro } from '@/lib/format';
import { ErrorMessage } from './forms';
import { PhotoStrip, PhotoUploader } from './photos';
import type { ActionResult } from '@/lib/errors';

const MONEY = new Set(['total', 'amount', 'refund', 'payout']);

function EventText({ m, locale }: { m: ThreadMessage; locale: string }) {
  const t = useTranslations('events');
  if (!m.event || !t.has(m.event.key)) return null;
  const values = Object.fromEntries(Object.entries(m.event.values ?? {}).map(([k, v]) => [k, MONEY.has(k) && typeof v === 'number' ? formatEuro(v, locale) : v]));
  return <>{t(m.event.key, values)}</>;
}

export function Thread({ requestId, studentId, initial, canWrite, locale, emptyHint }: {
  requestId: string; studentId: string; initial: ThreadMessage[]; canWrite: boolean; locale: string; emptyHint: string;
}) {
  const t = useTranslations('messages');
  const tc = useTranslations('common');
  const f = useFormatter();
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [result, setResult] = useState<ActionResult<ThreadMessage> | null>(null);
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const lastId = useRef(initial.at(-1)?.id ?? 0);

  const add = useCallback((list: ThreadMessage[]) => {
    if (!list.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...list.filter((m) => !seen.has(m.id))];
      lastId.current = Math.max(lastId.current, ...merged.map((m) => m.id));
      return merged;
    });
  }, []);

  // Poll for new messages while the conversation is open and visible.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      const res = await fetch(`/api/threads/${requestId}/${studentId}?after=${lastId.current}`, { cache: 'no-store' }).catch(() => null);
      if (res?.ok) add((await res.json()).messages);
    }, 5000);
    return () => clearInterval(id);
  }, [requestId, studentId, add]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);

  async function send() {
    if (sending || (!body.trim() && !photos.length)) return;
    setSending(true);
    const res = await sendMessageAction(requestId, studentId, body, photos.map((p) => p.id));
    setSending(false);
    setResult(res);
    if (res.ok && res.data) { add([res.data]); setBody(''); setPhotos([]); setUploaderKey((k) => k + 1); }
  }

  return (
    <>
      <div ref={box} aria-live="polite" className="flex h-[min(58vh,560px)] flex-col gap-2.5 overflow-y-auto overscroll-contain bg-linen p-5">
        {!messages.length && <p className="m-auto max-w-sm text-center text-[14px] text-ink-soft">{emptyHint}</p>}
        {messages.map((m) => m.kind === 'event' ? (
          <div key={m.id} className="my-1.5 flex flex-col items-center gap-0.5 self-center text-center">
            <span className="rounded-full bg-sand px-3.5 py-1.5 text-[13px] text-ink-soft"><EventText m={m} locale={locale} /></span>
            <time className="text-[11px] text-muted" dateTime={m.createdAt}>{f.dateTime(new Date(m.createdAt), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        ) : (
          <div key={m.id} className={`flex max-w-[min(78%,520px)] flex-col gap-1 ${m.mine ? 'items-end self-end' : 'self-start'}`}>
            {m.photos.length > 0 && <PhotoStrip photos={m.photos} size={140} />}
            {m.body ? <p className={`m-0 whitespace-pre-wrap break-words rounded-[22px] px-4 py-2.5 text-[15px] ${m.mine ? 'rounded-br-lg bg-sage text-linen' : 'rounded-bl-lg border border-seam bg-cotton'}`}>{m.body}</p>
              : !m.photos.length && <p className="m-0 rounded-[22px] border border-dashed border-seam-strong px-4 py-2.5 text-[14px] italic text-muted">{t('removed')}</p>}
            <time className="px-2 text-[11px] text-muted" dateTime={m.createdAt}>{f.dateTime(new Date(m.createdAt), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        ))}
      </div>
      {canWrite ? (
        <form className="flex flex-wrap items-end gap-2.5 border-t border-seam bg-cotton p-3.5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <div className={`w-full ${photos.length ? '' : 'contents'}`}>
            <PhotoUploader key={uploaderKey} max={4} compact value={photos} onChange={setPhotos} addLabel={t('addPhotos')} />
          </div>
          <label htmlFor="msg" className="sr-only">{t('placeholder')}</label>
          <textarea id="msg" rows={1} value={body} maxLength={4000} placeholder={t('placeholder')}
            onChange={(e) => { setBody(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            className="min-h-[50px] min-w-0 flex-1 resize-none rounded-3xl border border-seam-strong bg-linen px-4 py-3 text-[16px] outline-none focus:outline-2 focus:outline-sage" />
          <button type="submit" className="btn btn-sage" disabled={sending}>{tc('send')}</button>
          <div className="w-full empty:hidden"><ErrorMessage result={result} /></div>
        </form>
      ) : null}
    </>
  );
}
