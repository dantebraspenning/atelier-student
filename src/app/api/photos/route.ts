import { NextResponse } from 'next/server';
import { uploadPhoto } from '@/lib/domain/photos';
import { fail } from '@/lib/errors';
import { errorResponse, sameOrigin } from '@/lib/http';
import { MAX_UPLOAD_BYTES } from '@/lib/images';
import { requireActor } from '@/lib/session';

/** Upload one photo as the raw request body. Returns its id and URLs; it stays private until attached. */
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) fail('forbidden', 403);
    const actor = await requireActor();
    if (!(request.headers.get('content-type') ?? '').startsWith('image/')) fail('photoInvalid', 415);
    if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES) fail('photoTooLarge', 413);
    const data = Buffer.from(await request.arrayBuffer());
    const photo = await uploadPhoto(actor, data);
    return NextResponse.json({ photo }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
