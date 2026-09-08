import { NextRequest, NextResponse } from 'next/server';
import { archiveExpiredAlbums } from '@/lib/cleanup';

export const maxDuration = 60;

/**
 * Disparado a diario por el Cron de Vercel (ver vercel.json). Protegido con un
 * secreto compartido para que nadie más pueda llamarlo desde afuera.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const result = await archiveExpiredAlbums();
  return NextResponse.json(result);
}
