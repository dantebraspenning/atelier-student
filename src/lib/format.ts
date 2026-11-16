// Formatting helpers, safe to import in browser code.

export function formatEuro(cents: number, locale: string = 'nl') {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-IE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2
  }).format(cents / 100);
}

/** Parse a user-entered euro amount ("85", "85,50", "85.5") into cents. */
export function parseEuros(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/\s|€/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
