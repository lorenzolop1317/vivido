import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, isValidAdminSession } from '@/lib/admin-auth';
import { setAlbumRetentionEnabled, setAlbumStorageLimit, deleteAlbumCompletely } from '@/lib/albums';

/** Prende/apaga el auto-borrado por antigüedad, o cambia el tope de almacenamiento, de un álbum puntual. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminSession(session)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (typeof body?.retentionEnabled === 'boolean') {
    const result = await setAlbumRetentionEnabled(id, body.retentionEnabled);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (typeof body?.storageLimitBytes === 'number') {
    const result = await setAlbumStorageLimit(id, body.storageLimitBytes);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
}

/** Borra el álbum por completo: archivos en R2 + fila en la base. No se puede deshacer. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminSession(session)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const result = await deleteAlbumCompletely(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
