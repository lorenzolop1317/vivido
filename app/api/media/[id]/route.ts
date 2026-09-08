import { NextRequest, NextResponse } from 'next/server';
import { deleteMedia, clearDisplayVersion } from '@/lib/albums';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get('token');
  const deviceId = request.nextUrl.searchParams.get('deviceId') ?? undefined;

  if (!token) {
    return NextResponse.json({ error: 'Falta el token de acceso.' }, { status: 400 });
  }

  const result = await deleteMedia(token, id, deviceId);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

// Se usa cuando la copia liviana ("display") de una foto no se pudo subir
// después de reintentar: el original ya está a salvo, así que en vez de
// perder la foto entera solo limpiamos la referencia a esa copia y la
// galería sigue mostrando el original.
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.token !== 'string' || body.action !== 'clear-display') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const result = await clearDisplayVersion(body.token, id);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
