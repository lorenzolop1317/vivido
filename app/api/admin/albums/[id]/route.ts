import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminSecret } from '@/lib/admin-auth';
import { setAlbumRetentionEnabled, deleteAlbumCompletely } from '@/lib/albums';

/** Prende/apaga el auto-borrado por antigüedad de un álbum puntual. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (!isValidAdminSecret(body?.secret)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (typeof body?.retentionEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const result = await setAlbumRetentionEnabled(id, body.retentionEnabled);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/** Borra el álbum por completo: archivos en R2 + fila en la base. No se puede deshacer. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const secret = request.nextUrl.searchParams.get('secret');

  if (!isValidAdminSecret(secret)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const result = await deleteAlbumCompletely(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
