import { hashPassword } from 'better-auth/crypto';
import type { DB } from '@/lib/db';
import { account, message, portfolioPiece, quote, request, studentProfile, taxDetails, user, type Garment } from '@/lib/db/schema';
import { encrypt } from '@/lib/crypto';

/** Development-only demo password (never used in production — seeding refuses to run there). */
export const DEMO_PASSWORD = 'atelier-demo-2026';

const STUDENTS: {
  name: string; email: string; programme: string; school: string; year: string; city: string; bio: string; specialities: Garment[];
  skills: string[]; turnaround: string; accepting?: boolean; rates: [string, number][]; portfolio: [string, Garment, string, 'commission' | 'coursework'][];
}[] = [
  { name: 'Noor Haddad', email: 'noor@demo.atelier.test', programme: 'BA Fashion Design', school: 'AMFI', year: 'Year 3', city: 'Amsterdam',
    bio: 'I love fluid, bias-cut silhouettes and the moment a toile finally hangs right. Occasion dresses and slips are my thing, and I’m happy to work from your own fabric.',
    specialities: ['dress', 'skirt', 'rework'], skills: ['Bias cutting', 'Draping', 'Silk & satin'], turnaround: '~3 weeks',
    rates: [['Slip dress', 120], ['Occasion dress', 180], ['Rework', 45]],
    portfolio: [['Bias-cut slip dress', 'dress', 'Silk satin', 'commission'], ['Draped column gown', 'dress', 'Final-year toile', 'coursework'], ['Godet midi skirt', 'skirt', 'Wool crepe', 'commission']] },
  { name: 'Liv Okafor', email: 'liv@demo.atelier.test', programme: 'MA Tailoring', school: 'ArtEZ', year: 'Year 1', city: 'Arnhem',
    bio: 'Structured jackets and suiting, built the traditional way with canvas and hand padding — for bodies the high street ignores.',
    specialities: ['jacket', 'trousers'], skills: ['Canvassing', 'Suiting', 'Pattern drafting'], turnaround: '~4 weeks',
    rates: [['Tailored trousers', 110], ['Unlined jacket', 220]],
    portfolio: [['Double-breasted jacket', 'jacket', 'Wool flannel', 'coursework'], ['Pleated suit trousers', 'trousers', 'Tropical wool', 'commission']] },
  { name: 'Mateo Ruiz', email: 'mateo@demo.atelier.test', programme: 'BA Fashion Design', school: 'HKU', year: 'Year 2', city: 'Utrecht',
    bio: 'Trousers and denim for people who never find the right length. Long inseams, short inseams, curvy fits — send me your measurements.',
    specialities: ['trousers', 'shirt'], skills: ['Denim', 'Long & short fits', 'Workwear'], turnaround: '~2 weeks',
    rates: [['Trousers', 85], ['Shirt', 70]],
    portfolio: [['Wide-leg linen trousers', 'trousers', 'Mid-weight linen', 'commission'], ['Selvedge carpenter jeans', 'trousers', 'Denim', 'coursework']] },
  { name: 'Ines Varga', email: 'ines@demo.atelier.test', programme: 'BA Fashion & Textiles', school: 'KABK', year: 'Year 3', city: 'Den Haag',
    bio: 'Pleats, panels and movement. Skirts and dresses that swing, often in fabrics I dye myself.',
    specialities: ['skirt', 'dress'], skills: ['Pleating', 'Natural dyeing'], turnaround: '~3 weeks', accepting: false,
    rates: [['Midi skirt', 75]], portfolio: [['Sunray pleated skirt', 'skirt', 'Poly crepe', 'coursework']] },
  { name: 'Sam Achterberg', email: 'sam@demo.atelier.test', programme: 'BA Menswear', school: 'ArtEZ', year: 'Year 2', city: 'Arnhem',
    bio: 'Shirts and blouses with hand finishing — French seams, hand-sewn buttonholes, collars that keep their shape.',
    specialities: ['shirt'], skills: ['Shirting', 'Hand buttonholes'], turnaround: '~2 weeks',
    rates: [['Shirt or blouse', 65]], portfolio: [['Camp-collar shirt', 'shirt', 'Cotton poplin', 'commission']] },
  { name: 'Yuki Tanaka', email: 'yuki@demo.atelier.test', programme: 'BA Fashion Design', school: 'Willem de Kooning Academie', year: 'Year 4', city: 'Rotterdam',
    bio: 'I rework vintage coats and knitwear into pieces that fit you now. Bring the coat you never wear.',
    specialities: ['rework', 'jacket'], skills: ['Upcycling', 'Outerwear'], turnaround: '~4 weeks',
    rates: [['Coat rework', 90]], portfolio: [['Reworked opera coat', 'rework', 'Vintage wool', 'coursework'], ['Patchwork chore jacket', 'jacket', 'Deadstock canvas', 'coursework']] }
];

async function createUser(db: DB, name: string, email: string, role: 'customer' | 'student' | 'admin', password: string) {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name, email, emailVerified: true, role });
  await db.insert(account).values({ id: crypto.randomUUID(), accountId: id, providerId: 'credential', userId: id, password: await hashPassword(password) });
  return id;
}

/** Fill an empty development database with makers, customers, requests, a quote and messages. */
export async function seedDemo(db: DB) {
  const [any] = await db.select({ id: user.id }).from(user).limit(1);
  if (any) return false;
  const ids: Record<string, string> = {};
  for (const s of STUDENTS) {
    const id = await createUser(db, s.name, s.email, 'student', DEMO_PASSWORD);
    ids[s.email] = id;
    await db.insert(studentProfile).values({
      userId: id, slug: s.name.toLowerCase().replace(/[^a-z]+/g, '-'), programme: s.programme, school: s.school, year: s.year, city: s.city, bio: s.bio,
      specialities: s.specialities, skills: s.skills, turnaround: s.turnaround, accepting: s.accepting !== false,
      rates: s.rates.map(([label, eur]) => ({ label, fromCents: eur * 100 })), verification: 'verified', verifiedAt: new Date(),
      payoutsEnabled: true, stripeAccountId: `acct_sim_${id.slice(0, 8)}`
    });
    await db.insert(taxDetails).values({ userId: id, legalName: s.name, dateOfBirth: '2002-06-15', addressLine: 'Demostraat 1', postalCode: '1000AA', city: s.city, country: 'NL', tinEncrypted: encrypt('111222333') });
    for (const [title, garment, material, kind] of s.portfolio) await db.insert(portfolioPiece).values({ studentId: id, title, garment, material, kind });
  }
  const sara = await createUser(db, 'Sara Kuipers', 'sara@demo.atelier.test', 'customer', DEMO_PASSWORD);
  const femke = await createUser(db, 'Femke de Vries', 'femke@demo.atelier.test', 'customer', DEMO_PASSWORD);
  await createUser(db, 'Atelier Admin', 'admin@demo.atelier.test', 'admin', DEMO_PASSWORD);

  const [r1] = await db.insert(request).values({
    customerId: sara, garment: 'trousers', purpose: 'Shop sizes never fit me', title: 'Wide-leg linen trousers, extra-long',
    description: 'High-waisted wide-leg trousers in a mid-weight linen, long enough to wear with heels. Side pockets, no back pockets.',
    measurements: { waist: 76, hip: 102, inseam: 91, outseam: 116, rise: 29 }, fabric: 'source', budgetCents: 14000, delivery: 'either', city: 'Groningen'
  }).returning();
  const [r2] = await db.insert(request).values({
    customerId: femke, garment: 'dress', purpose: 'An occasion', title: 'Bias-cut slip for a winter wedding',
    description: 'Something fluid in dark green that works with a long coat. I’m 1.80 m and slips are always too short in the body.',
    measurements: { height: 180, bust: 90, waist: 72, hip: 98, sfloor: 148 }, fabric: 'own', budgetCents: 20000, delivery: 'in_person', city: 'Amsterdam'
  }).returning();
  const mateo = ids['mateo@demo.atelier.test'];
  await db.insert(quote).values({ requestId: r1.id, studentId: mateo, labourCents: 9500, fabricCents: 3200, shippingCents: 700, handover: 'shipping', alteration: false,
    message: 'I’d draft these from scratch for your inseam and cut them in a washed mid-weight linen. I’ll ship them tracked from Utrecht.' });
  await db.insert(message).values([
    { requestId: r1.id, studentId: mateo, senderId: sara, body: 'Thanks! Could you add a hidden button fly instead of a zip?' },
    { requestId: r1.id, studentId: mateo, senderId: mateo, body: 'Yes, no problem — same price. Wider or slimmer waistband than usual?' },
    { requestId: r2.id, studentId: ids['noor@demo.atelier.test'], senderId: ids['noor@demo.atelier.test'], body: 'Hi Femke, lovely brief. Is your green fabric a satin or a crepe? It changes how I’d cut the bias.' }
  ]);
  return true;
}
