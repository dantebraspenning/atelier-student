import { env } from '@/lib/env';

export { formatEuro, parseEuros } from '@/lib/format';

/** Platform fee on a commission total, rounded to whole cents. */
export function platformFee(totalCents: number, percent = env().PLATFORM_FEE_PERCENT) {
  return Math.round((totalCents * percent) / 100);
}
