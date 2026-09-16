import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminSecret } from '@/lib/admin-auth';
import { listAllAlbums } from '@/lib/albums';

/** Refresca la lista completa de álbumes para el panel de admin. */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  if (!isValidAdminSecret(secret)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const albums = await listAllAlbums();
  return NextResponse.json({ albums });
}
