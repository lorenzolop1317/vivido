import { NextRequest, NextResponse } from 'next/server';
import { requestUploadUrl } from '@/lib/albums';

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.contentType !== 'string' || typeof body.sizeBytes !== 'number') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const result = await requestUploadUrl(token, {
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
    durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined,
    width: typeof body.width === 'number' ? body.width : undefined,
    height: typeof body.height === 'number' ? body.height : undefined,
    uploaderLabel: typeof body.uploaderLabel === 'string' ? body.uploaderLabel : undefined,
    uploaderDeviceId: typeof body.uploaderDeviceId === 'string' ? body.uploaderDeviceId : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  return NextResponse.json(result);
}
