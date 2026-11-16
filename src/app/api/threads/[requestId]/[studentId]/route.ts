import { NextResponse } from 'next/server';
import { getThread } from '@/lib/domain/messages';
import { errorResponse } from '@/lib/http';
import { requireActor } from '@/lib/session';

/** Polled by the open conversation for new messages. */
export async function GET(request: Request, { params }: RouteContext<'/api/threads/[requestId]/[studentId]'>) {
  try {
    const { requestId, studentId } = await params;
    const after = Number(new URL(request.url).searchParams.get('after') ?? 0) || 0;
    const data = await getThread(await requireActor(), requestId, studentId, after);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
