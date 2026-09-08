import { NextRequest, NextResponse } from 'next/server';
import { getAlbumView } from '@/lib/albums';

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const view = await getAlbumView(token);

  if (!view) {
    return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 404 });
  }

  return NextResponse.json(view);
}
