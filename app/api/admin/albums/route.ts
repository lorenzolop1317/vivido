import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, isValidAdminSession } from '@/lib/admin-auth';
import { listAllAlbums } from '@/lib/albums';

/** Refresca la lista completa de álbumes para el panel de admin. */
export async function GET(request: NextRequest) {
  const session = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminSession(session)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const albums = await listAllAlbums();
  return NextResponse.json({ albums });
}
