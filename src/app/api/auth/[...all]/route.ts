import { getAuth } from '@/lib/auth';

// Better Auth endpoints: email verification links, password-reset links, session refresh.
export async function GET(request: Request) { return (await getAuth()).handler(request); }
export async function POST(request: Request) { return (await getAuth()).handler(request); }
