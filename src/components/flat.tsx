import type { Garment } from '@/lib/constants';

const PATHS: Record<Garment, string> = {
  dress: 'M48 8 L48 30 M72 8 L72 30 M44 30 L76 30 L72 58 L96 150 Q60 158 24 150 L48 58 Z M48 58 L72 58',
  trousers: 'M30 12 L90 12 L96 150 L68 150 L60 56 L52 150 L24 150 Z M30 22 L90 22 M60 22 L60 42',
  jacket: 'M42 12 L60 24 L78 12 L100 26 L108 120 L92 122 L86 62 L86 140 L34 140 L34 62 L28 122 L12 120 L20 26 Z M42 12 L52 64 L60 24 L68 64 L78 12 M60 64 L60 140',
  skirt: 'M36 16 L84 16 L84 28 L36 28 Z M36 28 L84 28 L104 146 Q60 154 16 146 Z M50 28 L44 146 M70 28 L76 146',
  shirt: 'M44 12 L60 20 L76 12 L102 30 L94 52 L84 46 L84 146 L36 146 L36 46 L26 52 L18 30 Z M60 20 L60 146 M44 12 L60 30 L76 12',
  rework: 'M44 8 L60 18 L76 8 L98 22 L106 110 L92 112 L86 54 L88 154 L32 154 L34 54 L28 112 L14 110 L22 22 Z M44 8 L50 56 L60 18 L70 56 L76 8 M60 56 L60 154'
};

export const TINT: Record<Garment, string> = { dress: 'tint-sage', trousers: 'tint-clay', jacket: 'tint-sand', skirt: 'tint-sand', shirt: 'tint-sage', rework: 'tint-clay' };

/** Technical flat (line drawing) of a garment — used wherever there is no photo. */
export function Flat({ garment, width = 120, height = 160, bold = false, label }: { garment: Garment; width?: number; height?: number; bold?: boolean; label?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 160" className={`flat${bold ? ' bold' : ''}`} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <path d={PATHS[garment] ?? PATHS.dress} />
    </svg>
  );
}

export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
