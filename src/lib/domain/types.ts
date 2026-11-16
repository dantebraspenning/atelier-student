import type { Role } from '@/lib/db/schema';

export type Actor = { id: string; role: Role; name: string; email: string; locale: 'nl' | 'en' };
