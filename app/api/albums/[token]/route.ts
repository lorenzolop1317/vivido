import { NextRequest, NextResponse } from 'next/server';
import { getAlbumPage, MEDIA_PAGE_SIZE } from '@/lib/albums';

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const deviceId = request.nextUrl.searchParams.get('deviceId');
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0') || 0;
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '') || MEDIA_PAGE_SIZE;
  const limit = Math.min(limitParam, 100); // tope de seguridad por si llega un valor raro

  const view = await getAlbumPage(token, { deviceId, offset, limit });

  if (!view) {
    return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 404 });
  }

  return NextResponse.json(view);
}
