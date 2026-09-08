import { NextRequest, NextResponse } from 'next/server';
import { getAlbumView } from '@/lib/albums';

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const deviceId = request.nextUrl.searchParams.get('deviceId');
  const view = await getAlbumView(token, deviceId);

  if (!view) {
    return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 404 });
  }

  return NextResponse.json(view);
}
