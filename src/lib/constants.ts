// Shared constants, safe to import in browser code.
export const GARMENTS = ['dress', 'trousers', 'jacket', 'skirt', 'shirt', 'rework'] as const;
export type Garment = (typeof GARMENTS)[number];
export type Rate = { label: string; fromCents: number };
