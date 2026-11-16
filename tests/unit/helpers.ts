import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { emailOutbox, studentProfile, user } from '@/lib/db/schema';
import { uniqueSlug } from '@/lib/auth';
import { saveTaxDetails } from '@/lib/domain/students';
import type { Actor } from '@/lib/domain/types';
import type { Garment } from '@/lib/db/schema';

let n = 0;

export async function makeUser(role: 'customer' | 'student' | 'admin', name = `${role} ${++n}`): Promise<Actor> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const email = `${role}${n}-${id.slice(0, 6)}@test.dev`;
  await db.insert(user).values({ id, name, email, emailVerified: true, role });
  if (role === 'student') await db.insert(studentProfile).values({ userId: id, slug: await uniqueSlug(db, name) });
  return { id, role, name, email, locale: 'nl' };
}

/** A student who has done everything needed to quote. */
export async function readyStudent(specialities: Garment[] = ['trousers', 'dress'], name?: string) {
  const s = await makeUser('student', name);
  const db = await getDb();
  await db.update(studentProfile).set({ specialities, city: 'Utrecht', verification: 'verified', verifiedAt: new Date(), payoutsEnabled: true, stripeAccountId: `acct_sim_${s.id.slice(0, 8)}` })
    .where(eq(studentProfile.userId, s.id));
  await saveTaxDetails(s, { legalName: s.name, dateOfBirth: '2003-04-05', addressLine: 'Oudegracht 1', postalCode: '3511AA', city: 'Utrecht', country: 'NL', tin: '111222333' });
  return s;
}

export async function emailsTo(to: string) {
  const db = await getDb();
  return db.select().from(emailOutbox).where(eq(emailOutbox.to, to));
}

/** A real JPEG carrying EXIF metadata (camera make + a GPS-like comment). */
export async function jpegWithExif(width = 2400, height = 1800) {
  return sharp({ create: { width, height, channels: 3, background: '#6b7d5c' } })
    .withExif({ IFD0: { Make: 'TestCam', Model: 'GPS-Leak 1000', ImageDescription: 'lat 52.37 lon 4.89' } })
    .jpeg().toBuffer();
}

export const trousersRequest = {
  garment: 'trousers' as const, purpose: 'Shop sizes never fit me', title: 'Wide-leg linen trousers, extra-long',
  description: 'High-waisted wide-leg trousers, 91 cm inseam, side pockets.', measurements: { waist: 76, inseam: '91', hip: '' },
  fabric: 'source' as const, budget: '150', delivery: 'either' as const, city: 'Groningen'
};
