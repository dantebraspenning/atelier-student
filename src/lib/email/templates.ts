// Transactional email copy in Dutch and English. `{name}`-style placeholders are filled from `values`.

export type Locale = 'nl' | 'en';

type Template = { subject: string; body: string[]; cta?: string };

export const EMAIL_TEMPLATES = {
  verifyEmail: {
    nl: { subject: 'Bevestig je e-mailadres', body: ['Hoi {name},', 'Welkom bij Atelier Student. Bevestig je e-mailadres om je account te activeren.', 'Deze link is 24 uur geldig.'], cta: 'E-mailadres bevestigen' },
    en: { subject: 'Confirm your email address', body: ['Hi {name},', 'Welcome to Atelier Student. Confirm your email address to activate your account.', 'This link is valid for 24 hours.'], cta: 'Confirm email address' }
  },
  resetPassword: {
    nl: { subject: 'Stel een nieuw wachtwoord in', body: ['Hoi {name},', 'Je hebt gevraagd om je wachtwoord opnieuw in te stellen. Deze link is 1 uur geldig.', 'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.'], cta: 'Nieuw wachtwoord instellen' },
    en: { subject: 'Set a new password', body: ['Hi {name},', 'You asked to reset your password. This link is valid for 1 hour.', 'Didn’t ask for this? You can ignore this email.'], cta: 'Set a new password' }
  },
  schoolEmail: {
    nl: { subject: 'Bevestig je studentenmail', body: ['Hoi {name},', 'Bevestig dat dit je studentenmail is om het label ‘Geverifieerde student’ te krijgen.'], cta: 'Studentenmail bevestigen' },
    en: { subject: 'Confirm your student email', body: ['Hi {name},', 'Confirm this is your student email to get the “Verified student” badge.'], cta: 'Confirm student email' }
  },
  studentVerified: {
    nl: { subject: 'Je bent geverifieerd als student', body: ['Hoi {name},', 'Je studentenstatus is bevestigd. Je kunt nu offertes sturen zodra je uitbetalingen hebt ingesteld.'], cta: 'Naar je studio' },
    en: { subject: 'You’re verified as a student', body: ['Hi {name},', 'Your student status is confirmed. You can send quotes once your payouts are set up.'], cta: 'Go to your studio' }
  },
  studentRejected: {
    nl: { subject: 'Je studentenverificatie is niet goedgekeurd', body: ['Hoi {name},', 'We konden je studentenstatus niet bevestigen. {note}', 'Je kunt het opnieuw proberen vanuit je studio.'], cta: 'Opnieuw proberen' },
    en: { subject: 'Your student verification wasn’t approved', body: ['Hi {name},', 'We couldn’t confirm your student status. {note}', 'You can try again from your studio.'], cta: 'Try again' }
  },
  newRequest: {
    nl: { subject: 'Nieuwe aanvraag voor jou: {title}', body: ['Hoi {name},', '{customer} heeft een aanvraag rechtstreeks naar jou gestuurd: “{title}”.'], cta: 'Bekijk de aanvraag' },
    en: { subject: 'New request for you: {title}', body: ['Hi {name},', '{customer} sent a request directly to you: “{title}”.'], cta: 'View the request' }
  },
  newQuote: {
    nl: { subject: 'Nieuwe offerte van {maker}', body: ['Hoi {name},', '{maker} heeft een offerte van {total} gestuurd voor “{title}”.'], cta: 'Bekijk offertes' },
    en: { subject: 'New quote from {maker}', body: ['Hi {name},', '{maker} sent a quote of {total} for “{title}”.'], cta: 'View quotes' }
  },
  quoteAccepted: {
    nl: { subject: 'Je offerte is geaccepteerd 🎉', body: ['Hoi {name},', '{customer} heeft je offerte voor “{title}” geaccepteerd en {total} betaald. Het bedrag staat veilig bij ons tot de klant het stuk heeft ontvangen.'], cta: 'Naar de opdracht' },
    en: { subject: 'Your quote was accepted 🎉', body: ['Hi {name},', '{customer} accepted your quote for “{title}” and paid {total}. We hold it safely until the customer has received the piece.'], cta: 'Go to the commission' }
  },
  quoteDeclined: {
    nl: { subject: 'Er is een andere maker gekozen', body: ['Hoi {name},', 'Voor “{title}” is een andere maker gekozen. Bedankt voor je offerte!'], cta: 'Bekijk nieuwe aanvragen' },
    en: { subject: 'Another maker was chosen', body: ['Hi {name},', 'Another maker was chosen for “{title}”. Thanks for quoting!'], cta: 'See new requests' }
  },
  paymentConfirmed: {
    nl: { subject: 'Betaling ontvangen — {maker} gaat aan de slag', body: ['Hoi {name},', 'We hebben je betaling van {total} ontvangen. We houden het bedrag vast tot jij bevestigt dat je stuk is aangekomen.'], cta: 'Bekijk je opdracht' },
    en: { subject: 'Payment received — {maker} is getting started', body: ['Hi {name},', 'We received your payment of {total}. We hold it until you confirm your piece has arrived.'], cta: 'View your commission' }
  },
  pieceSent: {
    nl: { subject: '{maker} heeft je stuk {how}', body: ['Hoi {name},', 'Je stuk “{title}” is {how}. Bevestig in je account dat je het hebt ontvangen. Als je niets doet, wordt de betaling op {date} automatisch vrijgegeven.'], cta: 'Ontvangst bevestigen' },
    en: { subject: '{maker} has {how} your piece', body: ['Hi {name},', 'Your piece “{title}” has been {how}. Confirm in your account that you received it. If you do nothing, payment is released automatically on {date}.'], cta: 'Confirm receipt' }
  },
  receiptReminder: {
    nl: { subject: 'Heb je je stuk ontvangen?', body: ['Hoi {name},', 'Heb je “{title}” ontvangen? Bevestig het, vraag een aanpassing aan of meld een probleem vóór {date}. Daarna wordt de betaling automatisch vrijgegeven.'], cta: 'Naar je opdracht' },
    en: { subject: 'Did you receive your piece?', body: ['Hi {name},', 'Did you receive “{title}”? Confirm it, ask for an alteration or report a problem before {date}. After that, payment is released automatically.'], cta: 'Go to your commission' }
  },
  paymentReleased: {
    nl: { subject: '{amount} is naar je onderweg', body: ['Hoi {name},', 'De betaling voor “{title}” is vrijgegeven: {amount} (na {fee} platformkosten) wordt naar je rekening overgemaakt.', 'Vergeet niet het stuk aan je portfolio toe te voegen!'], cta: 'Toevoegen aan portfolio' },
    en: { subject: '{amount} is on its way to you', body: ['Hi {name},', 'Payment for “{title}” has been released: {amount} (after {fee} platform fee) is being paid out to your bank account.', 'Don’t forget to add the piece to your portfolio!'], cta: 'Add to portfolio' }
  },
  alterationRequested: {
    nl: { subject: 'Aanpassing gevraagd voor “{title}”', body: ['Hoi {name},', '{customer} vraagt om de inbegrepen aanpassing: “{note}”.'], cta: 'Bekijk de opdracht' },
    en: { subject: 'Alteration requested for “{title}”', body: ['Hi {name},', '{customer} asked for the included alteration: “{note}”.'], cta: 'View the commission' }
  },
  newMessage: {
    nl: { subject: 'Nieuw bericht van {from}', body: ['Hoi {name},', '{from} stuurde je een bericht over “{title}”:', '“{preview}”'], cta: 'Antwoorden' },
    en: { subject: 'New message from {from}', body: ['Hi {name},', '{from} sent you a message about “{title}”:', '“{preview}”'], cta: 'Reply' }
  },
  cancellationProposed: {
    nl: { subject: 'Voorstel om “{title}” te annuleren', body: ['Hoi {name},', '{from} stelt voor de opdracht te annuleren, met een terugbetaling van {refund} aan de klant. Reden: “{reason}”.'], cta: 'Bekijk het voorstel' },
    en: { subject: 'Proposal to cancel “{title}”', body: ['Hi {name},', '{from} proposes to cancel the commission, refunding {refund} to the customer. Reason: “{reason}”.'], cta: 'View the proposal' }
  },
  commissionCancelled: {
    nl: { subject: 'Opdracht “{title}” is geannuleerd', body: ['Hoi {name},', 'De opdracht is geannuleerd. Terugbetaald aan de klant: {refund}. Uitbetaald aan de maker: {payout}.'], cta: 'Bekijk details' },
    en: { subject: 'Commission “{title}” was cancelled', body: ['Hi {name},', 'The commission was cancelled. Refunded to the customer: {refund}. Paid to the maker: {payout}.'], cta: 'View details' }
  },
  disputeOpened: {
    nl: { subject: 'Er is een probleem gemeld bij “{title}”', body: ['Hoi {name},', 'Er is een probleem gemeld. De betaling blijft vastgehouden terwijl ons team meekijkt. We nemen binnen 2 werkdagen contact op.'], cta: 'Bekijk de opdracht' },
    en: { subject: 'A problem was reported with “{title}”', body: ['Hi {name},', 'A problem was reported. Payment stays on hold while our team takes a look. We’ll be in touch within 2 working days.'], cta: 'View the commission' }
  },
  disputeResolved: {
    nl: { subject: 'Uitkomst van de melding bij “{title}”', body: ['Hoi {name},', 'Ons team heeft de melding afgehandeld. Terugbetaald aan de klant: {refund}. Uitbetaald aan de maker: {payout}.', '{note}'], cta: 'Bekijk details' },
    en: { subject: 'Outcome of the report on “{title}”', body: ['Hi {name},', 'Our team has resolved the report. Refunded to the customer: {refund}. Paid to the maker: {payout}.', '{note}'], cta: 'View details' }
  },
  reviewReceived: {
    nl: { subject: 'Je hebt een nieuwe review ({rating}/5)', body: ['Hoi {name},', '{customer} heeft een review achtergelaten voor “{title}”.'], cta: 'Bekijk en reageer' },
    en: { subject: 'You got a new review ({rating}/5)', body: ['Hi {name},', '{customer} left a review for “{title}”.'], cta: 'View and reply' }
  },
  adminAlert: {
    nl: { subject: '[Admin] {subject}', body: ['{text}'], cta: 'Openen in admin' },
    en: { subject: '[Admin] {subject}', body: ['{text}'], cta: 'Open in admin' }
  },
  accountDeleted: {
    nl: { subject: 'Je account is verwijderd', body: ['Hoi {name},', 'Je account bij Atelier Student is verwijderd. Gegevens die we wettelijk moeten bewaren (zoals betalingen) bewaren we geanonimiseerd.'] },
    en: { subject: 'Your account has been deleted', body: ['Hi {name},', 'Your Atelier Student account has been deleted. Records we must keep by law (such as payments) are kept in anonymised form.'] }
  }
} satisfies Record<string, Record<Locale, Template>>;

export type EmailTemplate = keyof typeof EMAIL_TEMPLATES;

const FOOTER = {
  nl: 'Je ontvangt deze e-mail omdat je een account hebt bij Atelier Student.',
  en: 'You’re receiving this email because you have an Atelier Student account.'
};

const fill = (s: string, values: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (values[k] === undefined ? '' : String(values[k])));

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderEmail(template: EmailTemplate, locale: Locale, values: Record<string, string | number>, url?: string, company = 'Atelier Student') {
  const t: Template = EMAIL_TEMPLATES[template][locale];
  const subject = fill(t.subject, values);
  const paragraphs = t.body.map((p) => fill(p, values)).filter((p) => p.trim());
  const text = [...paragraphs, url && t.cta ? `${t.cta}: ${url}` : '', '', `— ${company}`, FOOTER[locale]].filter((l) => l !== undefined).join('\n\n');
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#F6F3EC;font-family:Inter,Helvetica,Arial,sans-serif;color:#1E1C18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F3EC;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBF9F4;border:1px solid #DDD5C7;border-radius:28px">
<tr><td style="padding:32px 36px 8px;font-family:Georgia,serif;font-size:26px">atelier <span style="font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#69635A">student</span></td></tr>
<tr><td style="padding:8px 36px 8px;font-size:16px;line-height:1.55">${paragraphs.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join('')}</td></tr>
${url && t.cta ? `<tr><td style="padding:8px 36px 32px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#4A5A3F;color:#F6F3EC;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:600">${escapeHtml(t.cta)}</a></td></tr>` : ''}
</table>
<p style="font-size:12px;color:#69635A;max-width:560px;margin:16px auto 0">${escapeHtml(company)} · ${escapeHtml(FOOTER[locale])}</p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}
