import { NextRequest, NextResponse } from 'next/server';
import { deleteMedia } from '@/lib/albums';

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
