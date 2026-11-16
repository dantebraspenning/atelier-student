'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PhotoRef } from '@/lib/domain/photos';
import type { Garment } from '@/lib/constants';
import { Flat, TINT } from './flat';
import { useToast } from './forms';
import { Back, Arrow, Camera, Close } from './icons';

// ─────────────── upload ───────────────

/** Downscale big phone photos in the browser first (faster uploads); the server re-processes anyway. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 4_000_000) { bmp.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.9));
  } catch {
    return file; // e.g. HEIC on desktop Chrome: let the server try
  }
}

export async function uploadFile(file: File): Promise<PhotoRef> {
  const body = await shrink(file);
  const res = await fetch('/api/photos', { method: 'POST', headers: { 'Content-Type': body.type || 'image/jpeg' }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'unexpected');
  return data.photo;
}

/**
 * Pick → upload → thumbnails with remove buttons. Emits hidden `name` inputs with the photo ids,
 * so it drops into any form.
 */
export function PhotoUploader({ name = 'photoIds', max, value, onChange, compact = false, addLabel }: {
  name?: string; max: number; value?: PhotoRef[]; onChange?: (photos: PhotoRef[]) => void; compact?: boolean; addLabel?: string;
}) {
  const t = useTranslations('photos');
  const te = useTranslations('errors');
  const toast = useToast();
  const [own, setOwn] = useState<PhotoRef[]>(value ?? []);
  const photos = value ?? own;
  const [busy, setBusy] = useState(0);
  const latest = useRef(photos);
  useEffect(() => { latest.current = photos; }, [photos]);
  const set = (next: PhotoRef[]) => { latest.current = next; setOwn(next); onChange?.(next); };

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const room = max - latest.current.length - busy;
    const chosen = [...files].slice(0, Math.max(room, 0));
    if (files.length > chosen.length) toast(t('limit', { max, count: chosen.length }));
    for (const file of chosen) {
      setBusy((b) => b + 1);
      try { set([...latest.current, await uploadFile(file)]); }
      catch (e) { const key = (e as Error).message; toast(te.has(key) ? te(key) : t('unreadable', { name: file.name })); }
      finally { setBusy((b) => b - 1); }
    }
  }

  function remove(id: string) {
    set(latest.current.filter((p) => p.id !== id));
    void fetch(`/api/photos/${id}`, { method: 'DELETE' });
  }

  const size = compact ? 'size-[72px] rounded-2xl' : 'size-[104px] rounded-[20px]';
  return (
    <div className="flex flex-wrap gap-2.5" data-uploader>
      {photos.map((p, i) => (
        <figure key={p.id} className={`relative m-0 overflow-hidden bg-sand ${size}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumbUrl} alt={t('uploaded', { n: i + 1 })} className="size-full object-cover" />
          <input type="hidden" name={name} value={p.id} />
          <button type="button" onClick={() => remove(p.id)} aria-label={t('remove', { n: i + 1 })}
            className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink/75 text-linen hover:bg-ink"><Close size={14} /></button>
        </figure>
      ))}
      {Array.from({ length: busy }, (_, i) => (
        <div key={`b${i}`} role="status" className={`grid place-items-center bg-sand ${size}`}>
          <span className="size-5 animate-spin rounded-full border-2 border-seam-strong border-t-sage" aria-hidden />
          <span className="sr-only">{t('uploading')}</span>
        </div>
      ))}
      {photos.length + busy < max && (
        <label className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 border-[1.5px] border-dashed border-seam-strong bg-linen text-center text-[13px] font-medium text-sage-deep hover:border-sage focus-within:outline-2 focus-within:outline-sage ${size}`}>
          <Camera />
          {!compact && <span>{addLabel ?? t('add')}</span>}
          {!compact && <span className="text-[12px] font-normal text-muted">{photos.length}/{max}</span>}
          <input type="file" accept="image/*" multiple className="sr-only" aria-label={addLabel ?? t('add')}
            onChange={(e) => { void pick(e.target.files); e.target.value = ''; }} />
        </label>
      )}
    </div>
  );
}

// ─────────────── viewing ───────────────

function Lightbox({ photos, start, onClose }: { photos: PhotoRef[]; start: number; onClose: () => void }) {
  const t = useTranslations('photos');
  const tc = useTranslations('common');
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(start);
  useEffect(() => { ref.current?.showModal(); }, []);
  const step = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  return (
    <dialog ref={ref} aria-label={t('viewer')} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-ink/85 open:flex open:items-center open:justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[i].url} alt={t('open', { n: i + 1, total: photos.length })} className="max-h-[86vh] max-w-[92vw] rounded-[20px] bg-sand object-contain" />
      <button type="button" onClick={() => ref.current?.close()} aria-label={tc('close')} className="fixed right-5 top-5 grid size-12 place-items-center rounded-full bg-cotton/90"><Close /></button>
      {photos.length > 1 && <>
        <button type="button" onClick={() => step(-1)} aria-label={t('previous')} className="fixed left-5 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-cotton/90"><Back /></button>
        <button type="button" onClick={() => step(1)} aria-label={t('next')} className="fixed right-5 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-cotton/90"><Arrow /></button>
        <span className="fixed bottom-6 left-1/2 -translate-x-1/2 text-sm text-linen">{i + 1} / {photos.length}</span>
      </>}
    </dialog>
  );
}

/** Thumbnails that open a full-screen viewer. */
export function PhotoStrip({ photos, size = 92 }: { photos: PhotoRef[]; size?: number }) {
  const t = useTranslations('photos');
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      {photos.map((p, i) => (
        <button key={p.id} type="button" onClick={() => setOpen(i)} aria-label={t('open', { n: i + 1, total: photos.length })}
          className="cursor-zoom-in overflow-hidden rounded-[18px] border border-seam bg-sand p-0" style={{ width: size, height: size }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
        </button>
      ))}
      {open !== null && <Lightbox photos={photos} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Arch-framed cover image for a portfolio piece; falls back to the garment drawing. */
export function PieceMedia({ title, garment, photos, height = 300, label }: { title: string; garment: Garment; photos: PhotoRef[]; height?: number; label: string }) {
  const [open, setOpen] = useState(false);
  if (!photos.length) {
    return <div className={`arch ${TINT[garment]}`} style={{ height }}><Flat garment={garment} width={height * 0.4} height={height * 0.55} label={title} /></div>;
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} className="arch group w-full cursor-zoom-in border-0 bg-sand p-0" style={{ height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[0].thumbUrl} alt={title} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        {photos.length > 1 && <span className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1 rounded-full bg-cotton/90 px-2.5 py-1 text-[13px] font-medium"><Camera size={15} />{photos.length}</span>}
      </button>
      {open && <Lightbox photos={photos} start={0} onClose={() => setOpen(false)} />}
    </>
  );
}
