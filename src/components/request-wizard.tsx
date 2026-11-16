'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { createRequestAction } from '@/app/actions/marketplace';
import { GARMENTS, type Garment } from '@/lib/constants';
import type { PhotoRef } from '@/lib/domain/photos';
import { Flat, TINT } from './flat';
import { ErrorMessage, flash } from './forms';
import { Arrow, Back, Shield } from './icons';
import { PhotoStrip, PhotoUploader } from './photos';
import type { ActionResult } from '@/lib/errors';

const MEASURES: Record<'trousers' | 'dress' | 'other', string[]> = {
  trousers: ['waist', 'hip', 'inseam', 'outseam', 'rise', 'thigh'],
  dress: ['height', 'bust', 'waist', 'hip', 'sfloor', 'nape'],
  other: ['height', 'chest', 'waist', 'shoulder', 'sleeve', 'back']
};
const measuresFor = (g: string) => (g === 'trousers' ? MEASURES.trousers : g === 'dress' || g === 'skirt' ? MEASURES.dress : MEASURES.other);
const PURPOSES = ['occasion', 'everyday', 'work', 'fit'] as const;

type Draft = {
  step: number; garment: Garment | ''; purpose: string; measurements: Record<string, string>; measureInPerson: boolean;
  title: string; description: string; fabric: 'own' | 'source'; budget: string; neededBy: string; delivery: 'either' | 'in_person' | 'shipping';
  city: string; photos: PhotoRef[]; targetSlug: string | null; targetName: string;
};
const blank = (): Draft => ({ step: 1, garment: '', purpose: '', measurements: {}, measureInPerson: false, title: '', description: '', fabric: 'source', budget: '', neededBy: '', delivery: 'either', city: '', photos: [], targetSlug: null, targetName: '' });
const KEY = 'atelier-request-draft';

export function RequestWizard({ signedIn, initialGarment, target }: { signedIn: boolean; initialGarment?: string; target?: { slug: string; name: string } | null }) {
  const t = useTranslations('wizard');
  const tg = useTranslations('garment');
  const tgs = useTranslations('garments');
  const tm = useTranslations('measure');
  const td = useTranslations('delivery');
  const tc = useTranslations('common');
  const router = useRouter();
  // Rendered client-only (see RequestWizardLoader), so the saved draft can be read during initial render.
  const [d, setD] = useState<Draft>(() => {
    let draft = blank();
    try { draft = { ...draft, ...JSON.parse(sessionStorage.getItem(KEY) ?? '{}') }; } catch { /* ignore */ }
    if (initialGarment && (GARMENTS as readonly string[]).includes(initialGarment) && !draft.garment) draft.garment = initialGarment as Garment;
    if (target) { draft.targetSlug = target.slug; draft.targetName = target.name; }
    return draft;
  });
  const [error, setError] = useState('');
  const [result, setResult] = useState<ActionResult<{ id: string }> | null>(null);
  const [pending, start] = useTransition();

  // The draft survives the sign-up detour.
  useEffect(() => { sessionStorage.setItem(KEY, JSON.stringify(d)); }, [d]);

  const set = (patch: Partial<Draft>) => { setError(''); setD((x) => ({ ...x, ...patch })); };
  const filled = Object.entries(d.measurements).filter(([, v]) => v !== '');

  function validate(step: number) {
    if (step === 1 && !d.garment) return t('errGarment');
    if (step === 2 && !d.measureInPerson && filled.length < 2) return t('errMeasurements');
    if (step === 3 && (d.title.trim().length < 3 || d.description.trim().length < 10)) return t('errDetails');
    if (step === 3 && d.delivery === 'in_person' && !d.city.trim()) return t('errCity');
    return '';
  }

  function next() {
    const err = validate(d.step);
    if (err) return setError(err);
    if (d.step < 4) { set({ step: d.step + 1 }); window.scrollTo({ top: 0 }); return; }
    if (!signedIn) { router.push(`/sign-up?role=customer&next=${encodeURIComponent('/request')}`); return; }
    start(async () => {
      const payload = {
        garment: d.garment, purpose: d.purpose ? t(`purposes.${d.purpose as (typeof PURPOSES)[number]}`) : '', title: d.title, description: d.description,
        measurements: Object.fromEntries(filled), measureInPerson: d.measureInPerson, fabric: d.fabric, budget: d.budget || null,
        neededBy: d.neededBy || null, delivery: d.delivery, city: d.city, targetSlug: d.targetSlug, photoIds: d.photos.map((p) => p.id)
      };
      const res = await createRequestAction(JSON.stringify(payload));
      setResult(res);
      if (res.ok && res.data) {
        sessionStorage.removeItem(KEY);
        flash(t('sent'));
        router.push(`/requests/${res.data.id}`);
      }
    });
  }

  const steps = ['piece', 'measurements', 'details', 'review'] as const;

  return (
    <div className="wrap-narrow flex flex-wrap items-start gap-12 py-12">
      <aside className="flex max-w-[260px] flex-[1_1_220px] flex-col gap-6 pt-2" aria-label={t('title')}>
        <h1 className="h2 !text-[40px]">{t('title')}</h1>
        {d.targetSlug && <span className="badge badge-sage w-fit">{t('for', { name: d.targetName })}</span>}
        <ol className="flex list-none flex-col p-0">
          {steps.map((s, i) => {
            const n = i + 1; const state = d.step === n ? 'current' : d.step > n ? 'done' : '';
            return (
              <li key={s} aria-current={state === 'current' ? 'step' : undefined} className={`flex items-center gap-3.5 py-2 text-[15px] ${state ? 'text-ink' : 'text-muted'} ${state === 'current' ? 'font-medium' : ''}`}>
                <span className={`grid size-8 flex-none place-items-center rounded-full border text-[13px] font-semibold ${state === 'current' ? 'border-ink bg-ink text-linen' : state === 'done' ? 'border-sage bg-sage text-linen' : 'border-seam-strong'}`}>{state === 'done' ? '✓' : n}</span>
                {t(`steps.${s}`)}
              </li>
            );
          })}
        </ol>
        <hr className="stitch" />
        <span className="text-[14px] text-muted">{t('freeToPost')}</span>
        <button type="button" className="text-link w-fit !text-muted" onClick={() => { d.photos.forEach((p) => void fetch(`/api/photos/${p.id}`, { method: 'DELETE' })); setD({ ...blank(), targetSlug: d.targetSlug, targetName: d.targetName }); }}>{t('startOver')}</button>
      </aside>

      <section className="card card-lg flex min-w-0 flex-[999_1_560px] flex-col gap-8" aria-live="polite">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">{t('stepOf', { step: d.step })}{d.step === 2 && d.garment ? ` · ${tg(d.garment)}` : ''}</span>
          <h2 className="h2 !text-[44px]">{[t('whatMade'), t('measurementsTitle'), t('detailsTitle'), t('reviewTitle')][d.step - 1]}</h2>
          {d.step === 2 && <p className="text-ink-soft">{t('measurementsLead')}</p>}
        </div>

        {d.step === 1 && (<>
          <div role="radiogroup" aria-label={t('whatMade')} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
            {GARMENTS.map((g) => (
              <button key={g} type="button" role="radio" aria-checked={d.garment === g} className="option items-start gap-3"
                onClick={() => set({ garment: g, measurements: d.garment === g ? d.measurements : {} })}>
                <span className={`thumb ${TINT[g]} !h-[104px] !w-full`}><Flat garment={g} width={66} height={88} bold /></span>
                <span className="h4 text-[16px]">{tg(g)}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3"><span className="label">{t('whatFor')}</span>
            <div role="radiogroup" aria-label={t('whatFor')} className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => <button key={p} type="button" role="radio" aria-checked={d.purpose === p} className="chip" onClick={() => set({ purpose: d.purpose === p ? '' : p })}>{t(`purposes.${p}`)}</button>)}
            </div>
          </div>
        </>)}

        {d.step === 2 && (<>
          <div className="flex flex-wrap items-start gap-6">
            <div className="grid flex-[1_1_360px] grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4.5">
              {measuresFor(d.garment).map((k) => (
                <div key={k} className="field">
                  <label htmlFor={`m-${k}`} className="label">{tm(k)}</label>
                  <div className="affix"><input id={`m-${k}`} inputMode="decimal" value={d.measurements[k] ?? ''} placeholder="0" aria-describedby={`m-${k}-h`}
                    onChange={(e) => set({ measurements: { ...d.measurements, [k]: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') } })} /><span>{tm('cm')}</span></div>
                  <span id={`m-${k}-h`} className="hint">{tm(`${k}Hint`)}</span>
                </div>
              ))}
            </div>
            <figure className="m-0 flex flex-[1_1_200px] flex-col items-center gap-3 rounded-[28px] bg-sand p-5 text-center">
              <svg role="img" aria-label={t('figureCaption')} width="110" height="170" viewBox="0 0 120 180" fill="none" stroke="#1E1C18" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="60" cy="16" r="10" /><path d="M60 26 L60 34 M40 36 L80 36 L84 80 L76 80 L74 54 L74 90 L46 90 L46 54 L44 80 L36 80 Z M46 90 L44 172 M74 90 L76 172 M60 96 L60 172" />
                <path d="M66 98 L66 172" stroke="#4A5A3F" strokeWidth="1.8" strokeDasharray="3 3" /><path d="M44 68 L76 68" stroke="#A35D3D" strokeWidth="1.8" strokeDasharray="3 3" />
              </svg>
              <figcaption className="text-[14px] text-ink-soft">{t('figureCaption')}</figcaption>
            </figure>
          </div>
          <label className="check rounded-[20px] border border-dashed border-seam-strong p-4">
            <input type="checkbox" checked={d.measureInPerson} onChange={(e) => set({ measureInPerson: e.target.checked })} /><span>{t('measureInPerson')}</span>
          </label>
        </>)}

        {d.step === 3 && (<>
          <div className="field"><label htmlFor="r-title" className="label">{t('titleLabel')}</label>
            <input id="r-title" className="input" maxLength={120} value={d.title} placeholder={t('titlePlaceholder')} onChange={(e) => set({ title: e.target.value })} /></div>
          <div className="field"><label htmlFor="r-desc" className="label">{t('descriptionLabel')}</label>
            <textarea id="r-desc" className="textarea" maxLength={3000} value={d.description} placeholder={t('descriptionPlaceholder')} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="flex flex-col gap-2"><span className="label">{t('photos')} <span className="font-normal text-muted">({tc('optional')})</span></span>
            <span className="hint">{t('photosHint')}</span>
            {signedIn ? <PhotoUploader max={6} value={d.photos} onChange={(photos) => set({ photos })} /> : <div className="notice notice-sand text-[14px]">{t('photosAfterSignup')}</div>}
          </div>
          <div className="flex flex-col gap-2"><span className="label">{t('fabric')}</span>
            <div role="radiogroup" aria-label={t('fabric')} className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {(['own', 'source'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={d.fabric === v} className="option" onClick={() => set({ fabric: v })}>
                  <span className="h4 text-[16px]">{t(v === 'own' ? 'fabricOwn' : 'fabricSource')}</span><span className="text-[13px] text-muted">{t(v === 'own' ? 'fabricOwnHint' : 'fabricSourceHint')}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4.5">
            <div className="field"><label htmlFor="r-budget" className="label">{t('budget')} <span className="font-normal text-muted">({tc('optional')})</span></label>
              <div className="affix"><span>€</span><input id="r-budget" inputMode="numeric" value={d.budget} placeholder={t('budgetPlaceholder')} onChange={(e) => set({ budget: e.target.value.replace(/[^\d,.]/g, '') })} /></div>
              <span className="hint">{t('budgetHint')}</span></div>
            <div className="field"><label htmlFor="r-date" className="label">{t('neededBy')} <span className="font-normal text-muted">({tc('optional')})</span></label>
              <input id="r-date" type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={d.neededBy} onChange={(e) => set({ neededBy: e.target.value })} />
              <span className="hint">{t('neededByHint')}</span></div>
          </div>
          <div className="flex flex-col gap-2"><span className="label">{t('deliveryTitle')}</span>
            <div role="radiogroup" aria-label={t('deliveryTitle')} className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              {(['either', 'in_person', 'shipping'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={d.delivery === v} className="option" onClick={() => set({ delivery: v })}>
                  <span className="h4 text-[16px]">{td(v)}</span><span className="text-[13px] text-muted">{td(`${v}Hint`)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field max-w-[340px]"><label htmlFor="r-city" className="label">{t('city')}</label>
            <input id="r-city" className="input" maxLength={60} autoComplete="address-level2" value={d.city} placeholder="Utrecht" onChange={(e) => set({ city: e.target.value })} />
            <span className="hint">{t('cityHint')}</span></div>
        </>)}

        {d.step === 4 && (<>
          <dl className="kv border-y border-dashed border-seam-strong py-5">
            <dt>{t('rPiece')}</dt><dd>{d.garment && tg(d.garment)}{d.purpose ? ` · ${t(`purposes.${d.purpose as 'occasion'}`)}` : ''}</dd>
            <dt>{t('rTitle')}</dt><dd>{d.title}</dd>
            <dt>{t('rMeasurements')}</dt><dd>{d.measureInPerson && !filled.length ? t('rMeasureInPerson') : filled.map(([k, v]) => `${tm(k)} ${v} cm`).join(' · ')}</dd>
            <dt>{t('rFabric')}</dt><dd>{t(d.fabric === 'own' ? 'fabricOwn' : 'fabricSource')}</dd>
            <dt>{t('rBudget')}</dt><dd>{d.budget ? `€${d.budget}` : t('rOpen')}</dd>
            <dt>{t('rNeededBy')}</dt><dd>{d.neededBy || t('rFlexible')}</dd>
            <dt>{t('rDelivery')}</dt><dd>{td(d.delivery)}{d.city ? ` · ${d.city}` : ''}</dd>
            <dt>{t('rPhotos')}</dt><dd>{d.photos.length ? <PhotoStrip photos={d.photos} size={64} /> : <>{t('rNone')} {signedIn && <button type="button" className="text-link" onClick={() => set({ step: 3 })}>{t('addPhotos')}</button>}</>}</dd>
            <dt>{t('rSentTo')}</dt><dd>{d.targetSlug ? <>{t('onlyTo', { name: d.targetName })} <button type="button" className="text-link" onClick={() => set({ targetSlug: null, targetName: '' })}>{t('sendToAll')}</button></> : t('allMatching', { garments: d.garment ? tgs(d.garment).toLowerCase() : '' })}</dd>
          </dl>
          <div className="notice notice-sage"><Shield /><span>{t('paymentNote')}</span></div>
          {!signedIn && <div className="notice notice-sand">{t('accountNote')}</div>}
        </>)}

        {error && <div role="alert" className="form-error">{error}</div>}
        <ErrorMessage result={result} />
        <div className="flex justify-between gap-3 border-t border-seam pt-6">
          <button type="button" className="btn btn-ghost" disabled={d.step === 1} onClick={() => set({ step: d.step - 1 })}><Back /> {tc('back')}</button>
          <button type="button" className={`btn btn-lg ${d.step === 4 ? 'btn-sage' : 'btn-ink'}`} disabled={pending} onClick={next}>
            {d.step === 4 ? (signedIn ? t('send') : t('continueToSend')) : tc('continue')} <Arrow />
          </button>
        </div>
        {d.step === 4 && !signedIn && <p className="text-center text-[14px] text-muted"><Link href={`/sign-in?next=${encodeURIComponent('/request')}`}>{t('haveAccount')}</Link></p>}
      </section>
    </div>
  );
}
