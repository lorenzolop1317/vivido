import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { resolveToken } from '@/lib/albums';
import { streamAlbumZip } from '@/lib/export';

export const maxDuration = 300; // 5 minutos — subilo en vercel.json/plan si hace falta más

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const resolved = await resolveToken(token);

  if (!resolved) {
    return NextResponse.json({ error: 'Enlace inválido.' }, { status: 404 });
  }

  const { role, album } = resolved;
  if (role !== 'organizer' && role !== 'moderator') {
    return NextResponse.json({ error: 'No tenés permiso para exportar este álbum.' }, { status: 403 });
  }

  const zipStream = streamAlbumZip(album.id) as unknown as Readable;
  const webStream = Readable.toWeb(zipStream) as unknown as ReadableStream;
  const safeName = album.name.replace(/[^a-z0-9-_]+/gi, '_');

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName || 'album'}.zip"`,
    },
  });
}
