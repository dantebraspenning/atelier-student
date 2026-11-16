import { NextResponse } from 'next/server';
import { discardPhoto, getPhotoFile } from '@/lib/domain/photos';
import { fail } from '@/lib/errors';
import { errorResponse, sameOrigin } from '@/lib/http';
import { getActor, requireActor } from '@/lib/session';

export async function GET(request: Request, { params }: RouteContext<'/api/photos/[id]'>) {
  try {
    const { id } = await params;
    const size = new URL(request.url).searchParams.get('size') === 'thumb' ? 'thumb' : 'full';
    const file = await getPhotoFile(await getActor(), id, size);
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.data.length),
        'Cache-Control': file.isPublic ? 'public, max-age=86400, stale-while-revalidate=604800' : 'private, max-age=3600',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(request: Request, { params }: RouteContext<'/api/photos/[id]'>) {
  try {
    if (!sameOrigin(request)) fail('forbidden', 403);
    await discardPhoto(await requireActor(), (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
