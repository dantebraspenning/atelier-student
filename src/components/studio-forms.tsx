'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { passAction, quoteAction, replyReviewAction, withdrawQuoteAction } from '@/app/actions/marketplace';
import {
  addPieceAction, addPiecePhotosAction, deletePieceAction, documentVerificationAction, payoutDashboardAction, payoutsAction, profileAction,
  schoolEmailAction, taxAction
} from '@/app/actions/studio';
import { GARMENTS, type Garment, type Rate } from '@/lib/constants';
import { formatEuro } from '@/lib/format';
import { useRouter } from '@/i18n/navigation';
import { ActionForm, SubmitButton, useToast } from './forms';
import { Close } from './icons';
import { PhotoUploader, uploadFile } from './photos';

const euros = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };

export function QuoteComposer({ requestId, delivery, fabric, customerFirst, feePercent, canQuote }: {
  requestId: string; delivery: 'either' | 'in_person' | 'shipping'; fabric: 'own' | 'source'; customerFirst: string; feePercent: number; canQuote: boolean;
}) {
  const t = useTranslations('studio');
  const locale = useLocale();
  const options = delivery === 'either' ? (['in_person', 'shipping'] as const) : ([delivery] as const);
  const [handover, setHandover] = useState<'in_person' | 'shipping'>(options[0]);
  const [alteration, setAlteration] = useState(options[0] === 'in_person');
  const [labour, setLabour] = useState('');
  const [fab, setFab] = useState('');
  const [ship, setShip] = useState('');
  const total = euros(labour) + (fabric === 'source' ? euros(fab) : 0) + (handover === 'shipping' ? euros(ship) : 0);
  const payout = total - Math.round((total * feePercent) / 100);
  return (
    <ActionForm action={quoteAction} success={t('quoteSent')} className="flex flex-col gap-5">
      <input type="hidden" name="requestId" value={requestId} />
      <span className="h4">{t('yourQuote')}</span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
        <label className="field"><span className="label">{t('labour')}</span><span className="affix"><span>€</span><input name="labour" inputMode="decimal" required value={labour} onChange={(e) => setLabour(e.target.value)} placeholder="0" /></span></label>
        {fabric === 'source' && <label className="field"><span className="label">{t('fabric')}</span><span className="affix"><span>€</span><input name="fabric" inputMode="decimal" value={fab} onChange={(e) => setFab(e.target.value)} placeholder="0" /></span></label>}
        <label className="field"><span className="label">{t('readyBy')}</span><input name="readyBy" type="date" className="input" min={new Date().toISOString().slice(0, 10)} /></label>
      </div>
      <fieldset className="flex flex-col gap-2 border-0 p-0"><legend className="label mb-2">{t('howReaches', { name: customerFirst })}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label key={o} className="chip"><input type="radio" name="handover" value={o} className="sr-only" checked={handover === o}
              onChange={() => { setHandover(o); setAlteration(o === 'in_person'); }} />{o === 'shipping' ? t('shipIt') : t('inPerson')}</label>
          ))}
        </div>
        {delivery !== 'either' && <span className="text-[13px] text-muted">{t('customerAsked', { how: delivery })}</span>}
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        {handover === 'shipping' && <label className="field w-44"><span className="label">{t('shipping')}</span><span className="affix"><span>€</span><input name="shipping" inputMode="decimal" value={ship} onChange={(e) => setShip(e.target.value)} placeholder="0" /></span></label>}
        <label className="check min-h-11 items-center"><input type="checkbox" name="alteration" checked={alteration} onChange={(e) => setAlteration(e.target.checked)} /><span>{t('includeAlteration')}</span></label>
      </div>
      <label className="field"><span className="label">{t('messageLabel')}</span><textarea name="message" className="textarea" maxLength={2000} placeholder={t('messagePlaceholder')} /></label>
      {total > 0 && <p className="text-[14px] text-sage-deep">{formatEuro(total, locale)} → {t('youReceive', { amount: formatEuro(payout, locale), percent: feePercent })}</p>}
      <div className="flex justify-end"><SubmitButton disabled={!canQuote}>{t('sendQuote')}</SubmitButton></div>
    </ActionForm>
  );
}

export function PassButton({ requestId }: { requestId: string }) {
  const t = useTranslations('studio');
  return <ActionForm action={passAction} success={t('passed')}><input type="hidden" name="requestId" value={requestId} /><SubmitButton className="btn btn-ghost btn-sm">{t('pass')}</SubmitButton></ActionForm>;
}

export function WithdrawButton({ quoteId }: { quoteId: string }) {
  const t = useTranslations('studio');
  return <ActionForm action={withdrawQuoteAction} success={t('withdrawn')}><input type="hidden" name="quoteId" value={quoteId} /><SubmitButton className="text-link !text-[13px] !text-muted">{t('withdraw')}</SubmitButton></ActionForm>;
}

export function ProfileForm({ p, name }: { p: { programme: string; school: string; year: string; city: string; bio: string; turnaround: string; specialities: Garment[]; skills: string[]; rates: Rate[] }; name: string }) {
  const t = useTranslations('studio');
  const tg = useTranslations('garments');
  const tc = useTranslations('common');
  const [rates, setRates] = useState(p.rates.length ? p.rates.map((r) => ({ label: r.label, from: String(r.fromCents / 100) })) : [{ label: '', from: '' }]);
  return (
    <ActionForm action={profileAction} success={t('profileSaved')} className="card card-lg flex max-w-[820px] flex-col gap-5">
      <h2 className="h3">{t('profileTitle')}</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <label className="field"><span className="label">{t('name')}</span><input name="name" className="input" defaultValue={name} maxLength={80} required /></label>
        <label className="field"><span className="label">{t('school')}</span><input name="school" className="input" defaultValue={p.school} maxLength={80} /></label>
        <label className="field"><span className="label">{t('programme')}</span><input name="programme" className="input" defaultValue={p.programme} maxLength={80} /></label>
        <label className="field"><span className="label">{t('year')}</span><input name="year" className="input" defaultValue={p.year} maxLength={30} /></label>
        <label className="field"><span className="label">{t('city')}</span><input name="city" className="input" defaultValue={p.city} maxLength={60} required /></label>
        <label className="field"><span className="label">{t('turnaround')}</span><input name="turnaround" className="input" defaultValue={p.turnaround} maxLength={40} placeholder={t('turnaroundPlaceholder')} /></label>
      </div>
      <label className="field"><span className="label">{t('bio')}</span><textarea name="bio" className="textarea" defaultValue={p.bio} maxLength={1200} /></label>
      <fieldset className="flex flex-col gap-2 border-0 p-0"><legend className="label mb-2">{t('garmentsLabel')}</legend>
        <div className="flex flex-wrap gap-2">{GARMENTS.map((g) => <label key={g} className="chip"><input type="checkbox" name="specialities" value={g} className="sr-only" defaultChecked={p.specialities.includes(g)} />{tg(g)}</label>)}</div>
      </fieldset>
      <label className="field"><span className="label">{t('skills')}</span><input name="skills" className="input" defaultValue={p.skills.join(', ')} /><span className="hint">{t('skillsHint')}</span></label>
      <div className="flex flex-col gap-2"><span className="label">{t('rates')}</span>
        {rates.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input name="rateLabel" className="input" aria-label={t('rates')} defaultValue={r.label} placeholder={t('rateLabel')} maxLength={40} />
            <span className="affix w-40 flex-none"><span>€</span><input name="rateFrom" inputMode="decimal" aria-label="€" defaultValue={r.from} /></span>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={tc('remove')} onClick={() => setRates(rates.filter((_, j) => j !== i))}><Close /></button>
          </div>
        ))}
        <div><button type="button" className="text-link" onClick={() => setRates([...rates, { label: '', from: '' }])}>{t('addRate')}</button></div>
      </div>
      <div><SubmitButton className="btn btn-sage btn-lg">{tc('save')}</SubmitButton></div>
    </ActionForm>
  );
}

export function PieceForm({ from, defaultGarment }: { from?: { id: string; title: string; garment: Garment } | null; defaultGarment: Garment }) {
  const t = useTranslations('studio');
  const tm = useTranslations('maker');
  const tg = useTranslations('garment');
  return (
    <ActionForm action={addPieceAction} success={t('pieceAdded')} resetOnSuccess className="card flex flex-col gap-4">
      <h2 className="h3">{from ? t('addCommission') : t('addPiece')}</h2>
      {from && <><input type="hidden" name="commissionId" value={from.id} /><span className="notice notice-sage text-[14px]">{t('fromCommission', { title: from.title })}</span></>}
      <label className="field"><span className="label">{t('pieceTitle')}</span><input name="title" className="input" maxLength={100} defaultValue={from?.title} required /></label>
      <label className="field"><span className="label">{t('pieceGarment')}</span>
        <select name="garment" className="select" defaultValue={from?.garment ?? defaultGarment}>{GARMENTS.map((g) => <option key={g} value={g}>{tg(g)}</option>)}</select></label>
      <label className="field"><span className="label">{t('pieceMaterial')}</span><input name="material" className="input" maxLength={80} placeholder={t('pieceMaterialPlaceholder')} /></label>
      {!from && <label className="field"><span className="label">{t('pieceKind')}</span><select name="kind" className="select"><option value="coursework">{tm('coursework')}</option><option value="commission">{tm('commission')}</option></select></label>}
      <label className="field"><span className="label">{t('pieceStory')}</span><textarea name="story" className="textarea" maxLength={2000} placeholder={t('pieceStoryPlaceholder')} /></label>
      <div className="flex flex-col gap-2"><span className="label">{t('piecePhotos')}</span><PhotoUploader max={8} /><span className="hint">{t('piecePhotosHint')}</span></div>
      <div><SubmitButton>{t('addToPortfolio')}</SubmitButton></div>
    </ActionForm>
  );
}

export function PieceActions({ id }: { id: string }) {
  const t = useTranslations('studio');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of [...files].slice(0, 8)) ids.push((await uploadFile(f)).id);
      const res = await addPiecePhotosAction(id, ids);
      if (res.ok) router.refresh();
    } catch { toast(te('unexpected')); } finally { setBusy(false); }
  }
  return (
    <span className="flex items-center gap-3">
      <label className="text-link !text-[13px]" aria-busy={busy}>{t('addPhotos')}<input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} /></label>
      <ActionForm action={deletePieceAction} success={t('pieceRemoved')}><input type="hidden" name="id" value={id} />
        <SubmitButton className="text-link !text-[13px] !text-muted" confirm={t('deletePieceConfirm')}>{tc('remove')}</SubmitButton></ActionForm>
    </span>
  );
}

export function ReplyForm({ id }: { id: string }) {
  const t = useTranslations('studio');
  return (
    <ActionForm action={replyReviewAction} success={t('replied')} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="field"><span className="label">{t('replyLabel')}</span><textarea name="reply" className="textarea !min-h-20" maxLength={1000} required /></label>
      <div><SubmitButton className="btn btn-ghost btn-sm">{t('replySubmit')}</SubmitButton></div>
    </ActionForm>
  );
}

export function SchoolEmailForm({ domains }: { domains: string }) {
  const t = useTranslations('setup');
  return (
    <ActionForm action={schoolEmailAction} success={t('linkSent')} refresh={false} className="flex flex-col gap-3">
      <label className="field"><span className="label">{t('schoolEmail')}</span><input name="schoolEmail" type="email" className="input" required placeholder="naam@student.school.nl" /><span className="hint">{t('schoolEmailHint', { domains })}</span></label>
      <div><SubmitButton className="btn btn-ink btn-sm">{t('sendLink')}</SubmitButton></div>
    </ActionForm>
  );
}

export function DocumentForm() {
  const t = useTranslations('setup');
  return (
    <ActionForm action={documentVerificationAction} success={t('documentSent')} className="flex flex-col gap-3">
      <span className="label">{t('documentTitle')}</span>
      <PhotoUploader max={2} />
      <label className="field"><span className="label">{t('documentNote')}</span><input name="note" className="input" maxLength={500} /></label>
      <div><SubmitButton className="btn btn-ghost btn-sm">{t('documentSubmit')}</SubmitButton></div>
    </ActionForm>
  );
}

export function TaxForm({ initial }: { initial?: { legalName: string; dateOfBirth: string; addressLine: string; postalCode: string; city: string; country: string } | null }) {
  const t = useTranslations('setup');
  const tc = useTranslations('common');
  return (
    <ActionForm action={taxAction} success={t('taxSaved')} className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <label className="field"><span className="label">{t('legalName')}</span><input name="legalName" className="input" defaultValue={initial?.legalName} required autoComplete="name" /></label>
        <label className="field"><span className="label">{t('dateOfBirth')}</span><input name="dateOfBirth" type="date" className="input" defaultValue={initial?.dateOfBirth} required autoComplete="bday" /></label>
        <label className="field"><span className="label">{t('address')}</span><input name="addressLine" className="input" defaultValue={initial?.addressLine} required autoComplete="street-address" /></label>
        <label className="field"><span className="label">{t('postalCode')}</span><input name="postalCode" className="input" defaultValue={initial?.postalCode} required autoComplete="postal-code" /></label>
        <label className="field"><span className="label">{t('city')}</span><input name="city" className="input" defaultValue={initial?.city} required autoComplete="address-level2" /></label>
        <label className="field"><span className="label">{t('country')}</span><select name="country" className="select" defaultValue={initial?.country ?? 'NL'}>
          {['NL', 'BE', 'DE', 'FR', 'LU', 'AT', 'ES', 'IT', 'PT', 'IE', 'DK', 'SE', 'FI', 'PL'].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      </div>
      <label className="field max-w-xs"><span className="label">{t('tin')}</span><input name="tin" className="input" inputMode="numeric" required autoComplete="off" /><span className="hint">{t('tinHint')}</span></label>
      <div><SubmitButton className="btn btn-ink btn-sm">{tc('save')}</SubmitButton></div>
    </ActionForm>
  );
}

export function PayoutButton({ label, dashboard = false }: { label: string; dashboard?: boolean }) {
  return <ActionForm action={dashboard ? payoutDashboardAction : payoutsAction}><SubmitButton className={dashboard ? 'btn btn-ghost btn-sm' : 'btn btn-sage'}>{label}</SubmitButton></ActionForm>;
}
