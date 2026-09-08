import { getSupabaseAdmin } from './supabase';
import { deleteObject } from './r2';
import { computeWindows, type AlbumRow } from './albums';

/**
 * Recorre los álbumes activos/cerrados y archiva (borra el contenido de R2 y
 * marca status='archived') los que ya pasaron su ventana de retención.
 * Pensado para correr una vez al día desde un Cron de Vercel
 * (ver vercel.json y app/api/cron/cleanup/route.ts).
 */
export async function archiveExpiredAlbums() {
  const supabase = getSupabaseAdmin();
  const { data: albums, error } = await supabase.from('albums').select('*').neq('status', 'archived');
  if (error) throw error;

  let archivedCount = 0;

  for (const album of (albums ?? []) as AlbumRow[]) {
    const windows = computeWindows(album);
    if (!windows.isArchived) continue;

    const { data: mediaRows, error: mediaError } = await supabase
      .from('media')
      .select('id, r2_key, r2_key_display')
      .eq('album_id', album.id);
    if (mediaError) throw mediaError;

    for (const media of mediaRows ?? []) {
      await deleteObject(media.r2_key);
      if (media.r2_key_display) {
        await deleteObject(media.r2_key_display).catch(() => {});
      }
    }

    if (album.cover_image_key) {
      await deleteObject(album.cover_image_key).catch(() => {});
    }

    const { error: deleteMediaError } = await supabase.from('media').delete().eq('album_id', album.id);
    if (deleteMediaError) throw deleteMediaError;

    const { error: updateError } = await supabase
      .from('albums')
      .update({ status: 'archived' })
      .eq('id', album.id);
    if (updateError) throw updateError;

    archivedCount += 1;
  }

  return { archivedCount };
}
