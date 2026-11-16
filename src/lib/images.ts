import sharp, { type Metadata } from 'sharp';
import { fail } from '@/lib/errors';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'gif', 'tiff']);

/**
 * Decode any common photo format, apply EXIF rotation, then re-encode.
 * Re-encoding drops all metadata (GPS location, camera serials) and any payload hidden in the file.
 */
export async function processPhoto(input: Buffer) {
  if (input.length > MAX_UPLOAD_BYTES) fail('photoTooLarge', 413);
  let meta: Metadata;
  try { meta = await sharp(input, { failOn: 'error' }).metadata(); } catch { return fail('photoInvalid'); }
  if (!meta.format || !ALLOWED.has(meta.format)) fail('photoInvalid');
  if ((meta.width ?? 0) * (meta.height ?? 0) > 80_000_000) fail('photoTooLarge', 413);
  const base = sharp(input, { failOn: 'error' }).rotate();
  const full = await base.clone().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#FBF9F4' }).jpeg({ quality: 84, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const thumb = await base.clone().resize({ width: 600, height: 600, fit: 'cover', position: 'attention' })
    .flatten({ background: '#FBF9F4' }).webp({ quality: 78 }).toBuffer();
  return { full: full.data, width: full.info.width, height: full.info.height, thumb };
}
