import { NextRequest, NextResponse } from 'next/server';
import { requestCoverUploadUrl, confirmCoverImage, removeCoverImage, setCoverPosition } from '@/lib/albums';

// POST con {contentType, sizeBytes} -> pide la URL prefirmada para subir la portada.
// POST con {action: 'confirm', key} -> la deja activa una vez que ya se subió a R2.
// POST con {action: 'position', x, y} -> ajusta el encuadre de la portada ya subida.
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (body.action === 'confirm') {
    if (typeof body.key !== 'string') {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }
    const result = await confirmCoverImage(token, body.key);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'position') {
    if (typeof body.x !== 'number' || typeof body.y !== 'number') {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    }
    const result = await setCoverPosition(token, body.x, body.y);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.contentType !== 'string' || typeof body.sizeBytes !== 'number') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const result = await requestCoverUploadUrl(token, { contentType: body.contentType, sizeBytes: body.sizeBytes });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await removeCoverImage(token);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 403 });
  return NextResponse.json({ ok: true });
}
