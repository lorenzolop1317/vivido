import { getSupabaseAdmin } from './supabase';
import { createUploadUrl, getViewUrl, createDownloadUrl, deleteObject } from './r2';
import { generateAccessToken } from './tokens';
import { FREE_PLAN, kindForContentType, ACCEPTED_IMAGE_TYPES } from './limits';

const MAX_COVER_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — tope razonable para una foto de portada

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function downloadFilename(albumName: string, mediaId: string, contentType: string) {
  const extension = contentType.split('/')[1]?.replace('quicktime', 'mov') ?? 'bin';
  const base = slugify(albumName) || 'vivido';
  return `${base}-${mediaId.slice(0, 8)}.${extension}`;
}

export type AlbumRole = 'organizer' | 'moderator' | 'contributor' | 'viewer';

export interface AlbumRow {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
  plan: 'free' | 'pro';
  status: 'active' | 'closed' | 'archived';
  storage_limit_bytes: number;
  video_max_seconds: number | null;
  upload_window_days: number | null;
  retention_days: number | null;
  cover_image_key: string | null;
  created_at: string;
}

export interface MediaRow {
  id: string;
  album_id: string;
  r2_key: string;
  r2_key_display: string | null;
  kind: 'photo' | 'video';
  content_type: string;
  size_bytes: number;
  display_size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  uploaded_by_token: string | null;
  uploader_device_id: string | null;
  uploader_label: string | null;
  created_at: string;
}

export const MEDIA_PAGE_SIZE = 30;

export interface AlbumWindows {
  uploadOpen: boolean;
  uploadClosesAt: string | null;
  viewableUntil: string | null;
  isArchived: boolean;
}

const daysFromNow = (isoDate: string, days: number) => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d;
};

export function computeWindows(album: AlbumRow): AlbumWindows {
  const now = new Date();
  const uploadClosesAt =
    album.upload_window_days != null ? daysFromNow(album.created_at, album.upload_window_days) : null;
  const viewableUntilDate =
    album.retention_days != null ? daysFromNow(album.created_at, album.retention_days) : null;

  const closedByOrganizer = album.status !== 'active';
  const closedByWindow = uploadClosesAt != null && now > uploadClosesAt;

  return {
    uploadOpen: !closedByOrganizer && !closedByWindow,
    uploadClosesAt: uploadClosesAt ? uploadClosesAt.toISOString() : null,
    viewableUntil: viewableUntilDate ? viewableUntilDate.toISOString() : null,
    isArchived: album.status === 'archived' || (viewableUntilDate != null && now > viewableUntilDate),
  };
}

export async function resolveToken(token: string) {
  const supabase = getSupabaseAdmin();
  const { data: tokenRow, error: tokenError } = await supabase
    .from('album_tokens')
    .select('token, role, album_id')
    .eq('token', token)
    .maybeSingle();

  if (tokenError) throw tokenError;
  if (!tokenRow) return null;

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', tokenRow.album_id)
    .maybeSingle();

  if (albumError) throw albumError;
  if (!album) return null;

  return { role: tokenRow.role as AlbumRole, album: album as AlbumRow };
}

export async function getStorageUsedBytes(albumId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('media').select('size_bytes, display_size_bytes').eq('album_id', albumId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.size_bytes) + Number(row.display_size_bytes ?? 0), 0);
}

export type MediaItem = MediaRow & {
  viewUrl: string;
  downloadUrl: string;
  likeCount: number;
  likedByMe: boolean;
};

export interface AlbumViewModel {
  role: AlbumRole;
  album: AlbumRow;
  windows: AlbumWindows;
  storageUsedBytes: number;
  canUpload: boolean;
  canModerate: boolean; // borrar cualquier contenido, cerrar álbum, exportar
  coverImageUrl: string | null;
  media: MediaItem[];
  mediaTotal: number;
  hasMore: boolean;
}

async function attachLikesAndUrls(
  rows: Array<Record<string, unknown>>,
  album: AlbumRow,
  isArchived: boolean,
  deviceId?: string | null
): Promise<MediaItem[]> {
  const supabase = getSupabaseAdmin();
  const mediaIds = rows.map((row) => row.id as string);
  const likeCounts = new Map<string, number>();
  const likedByMeSet = new Set<string>();

  if (mediaIds.length > 0) {
    const { data: likeRows, error: likesError } = await supabase
      .from('media_likes')
      .select('media_id, device_id')
      .in('media_id', mediaIds);
    if (likesError) throw likesError;
    for (const like of likeRows ?? []) {
      likeCounts.set(like.media_id, (likeCounts.get(like.media_id) ?? 0) + 1);
      if (deviceId && like.device_id === deviceId) likedByMeSet.add(like.media_id);
    }
  }

  return Promise.all(
    rows.map(async (rawRow) => {
      const row = rawRow as unknown as MediaRow;
      return {
        ...row,
        // Para VER (miniatura/lightbox) preferimos la copia liviana si existe —
        // pesa mucho menos y carga más rápido. Para DESCARGAR siempre se usa el
        // archivo original: la persona quiere conservar la máxima calidad posible.
        viewUrl: isArchived ? '' : await getViewUrl(row.r2_key_display || row.r2_key),
        downloadUrl: isArchived ? '' : await createDownloadUrl(row.r2_key, downloadFilename(album.name, row.id, row.content_type)),
        likeCount: likeCounts.get(row.id) ?? 0,
        likedByMe: likedByMeSet.has(row.id),
      };
    })
  );
}

/**
 * Trae una "página" de fotos/videos de un álbum, más los datos generales
 * (rol, ventanas, uso de almacenamiento) que no dependen de qué página se
 * esté mirando. Se usa tanto para la carga inicial (offset 0) como para
 * "cargar más" a medida que se hace scroll.
 */
export async function getAlbumPage(
  token: string,
  options: { deviceId?: string | null; limit?: number; offset?: number } = {}
): Promise<AlbumViewModel | null> {
  const { deviceId, limit = MEDIA_PAGE_SIZE, offset = 0 } = options;
  const resolved = await resolveToken(token);
  if (!resolved) return null;
  const { role, album } = resolved;

  const supabase = getSupabaseAdmin();
  const windows = computeWindows(album);

  const [{ data: mediaRows, error }, { data: allSizes, error: sizesError }, { count: mediaTotal, error: countError }] =
    await Promise.all([
      supabase
        .from('media')
        .select('*')
        .eq('album_id', album.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase.from('media').select('size_bytes, display_size_bytes').eq('album_id', album.id),
      supabase.from('media').select('id', { count: 'exact', head: true }).eq('album_id', album.id),
    ]);
  if (error) throw error;
  if (sizesError) throw sizesError;
  if (countError) throw countError;

  const storageUsedBytes = (allSizes ?? []).reduce(
    (sum, row) => sum + Number(row.size_bytes) + Number(row.display_size_bytes ?? 0),
    0
  );
  const media = await attachLikesAndUrls(mediaRows ?? [], album, windows.isArchived, deviceId);
  const total = mediaTotal ?? media.length;
  const coverImageUrl = album.cover_image_key && !windows.isArchived ? await getViewUrl(album.cover_image_key) : null;

  return {
    role,
    album,
    windows,
    storageUsedBytes,
    canUpload: (role === 'organizer' || role === 'moderator' || role === 'contributor') && windows.uploadOpen,
    canModerate: role === 'organizer' || role === 'moderator',
    coverImageUrl,
    media,
    mediaTotal: total,
    hasMore: offset + media.length < total,
  };
}

export async function getAlbumView(token: string, deviceId?: string | null): Promise<AlbumViewModel | null> {
  return getAlbumPage(token, { deviceId });
}

export interface CreateAlbumInput {
  name: string;
  eventDate?: string | null;
  location?: string | null;
}

export interface CreateAlbumResult {
  albumId: string;
  links: Record<'organizer' | 'contributor' | 'viewer', string>;
}

export async function createAlbum(input: CreateAlbumInput): Promise<CreateAlbumResult> {
  const supabase = getSupabaseAdmin();

  const { data: album, error } = await supabase
    .from('albums')
    .insert({
      name: input.name,
      event_date: input.eventDate || null,
      location: input.location || null,
      storage_limit_bytes: FREE_PLAN.storageLimitBytes,
      video_max_seconds: FREE_PLAN.videoMaxSeconds,
      upload_window_days: FREE_PLAN.uploadWindowDays,
      retention_days: FREE_PLAN.retentionDays,
    })
    .select('id')
    .single();
  if (error) throw error;

  const roles: Array<'organizer' | 'contributor' | 'viewer'> = ['organizer', 'contributor', 'viewer'];
  const tokens = roles.map((role) => ({ token: generateAccessToken(), album_id: album.id, role }));

  const { error: tokenError } = await supabase.from('album_tokens').insert(tokens);
  if (tokenError) throw tokenError;

  const links = Object.fromEntries(
    tokens.map((t) => [t.role, `/a/${t.token}`])
  ) as CreateAlbumResult['links'];

  return { albumId: album.id, links };
}

export interface RequestUploadUrlInput {
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  /**
   * Si el navegador ya generó una copia liviana de la foto para mostrar en la
   * web (ver createDisplayVersion en AlbumWorkspace.tsx), estos dos datos
   * describen esa copia. El archivo ORIGINAL (contentType/sizeBytes de arriba)
   * siempre se sube igual, en máxima calidad — esto es solo un "extra" para
   * que la galería cargue más rápido.
   */
  displayContentType?: string;
  displaySizeBytes?: number;
  uploaderLabel?: string;
  /**
   * Id anónimo generado en el navegador de quien sube (ver components/AlbumWorkspace.tsx).
   * Como el enlace de "contribuyente" es uno solo y lo comparten todos los invitados,
   * este id es lo que permite que cada invitado borre solo lo que subió él mismo, sin
   * pedir login. No es una medida de seguridad fuerte (alguien con conocimientos técnicos
   * podría falsificarlo) — es un acuerdo de buena fe razonable para un álbum de amigos/familia,
   * no para contenido sensible. Documentado como limitación conocida del MVP.
   */
  uploaderDeviceId?: string;
}

export type RequestUploadUrlResult =
  | { ok: true; uploadUrl: string; uploadUrlDisplay?: string; mediaId: string }
  | { ok: false; reason: string };

export async function requestUploadUrl(
  token: string,
  input: RequestUploadUrlInput
): Promise<RequestUploadUrlResult> {
  const resolved = await resolveToken(token);
  if (!resolved) return { ok: false, reason: 'Enlace inválido.' };
  const { role, album } = resolved;

  if (role !== 'organizer' && role !== 'moderator' && role !== 'contributor') {
    return { ok: false, reason: 'Este enlace no tiene permiso para subir contenido.' };
  }

  const windows = computeWindows(album);
  if (!windows.uploadOpen) {
    return { ok: false, reason: 'El álbum ya cerró la ventana de subida.' };
  }

  const kind = kindForContentType(input.contentType);
  if (!kind) {
    return { ok: false, reason: 'Tipo de archivo no soportado.' };
  }

  if (kind === 'video' && album.video_max_seconds != null) {
    if (!input.durationSeconds || input.durationSeconds > album.video_max_seconds) {
      return { ok: false, reason: `Los videos no pueden superar los ${album.video_max_seconds} segundos en el plan gratis.` };
    }
  }

  const hasDisplayVersion = kind === 'photo' && !!input.displayContentType && !!input.displaySizeBytes;
  const used = await getStorageUsedBytes(album.id);
  if (used + input.sizeBytes + (hasDisplayVersion ? input.displaySizeBytes! : 0) > album.storage_limit_bytes) {
    return { ok: false, reason: 'El álbum llegó a su límite de almacenamiento del plan gratis.' };
  }

  const supabase = getSupabaseAdmin();
  const { data: mediaRow, error } = await supabase
    .from('media')
    .insert({
      album_id: album.id,
      r2_key: '', // se completa abajo, necesitamos el id primero para armar la key
      r2_key_display: hasDisplayVersion ? '' : null,
      kind,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      display_size_bytes: hasDisplayVersion ? input.displaySizeBytes : null,
      duration_seconds: input.durationSeconds ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      uploaded_by_token: token,
      uploader_device_id: input.uploaderDeviceId ?? null,
      uploader_label: input.uploaderLabel ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const extension = input.contentType.split('/')[1] ?? 'bin';
  const key = `albums/${album.id}/${mediaRow.id}.${extension}`;
  const displayKey = hasDisplayVersion ? `albums/${album.id}/${mediaRow.id}-display.jpg` : null;

  const { error: updateError } = await supabase
    .from('media')
    .update({ r2_key: key, r2_key_display: displayKey })
    .eq('id', mediaRow.id);
  if (updateError) throw updateError;

  const uploadUrl = await createUploadUrl(key, input.contentType);
  const uploadUrlDisplay = displayKey ? await createUploadUrl(displayKey, input.displayContentType!) : undefined;

  return { ok: true, uploadUrl, uploadUrlDisplay, mediaId: mediaRow.id };
}

/**
 * Se llama cuando la subida del archivo original salió bien pero la de su
 * copia liviana ("display") falló después de reintentar — en vez de perder
 * toda la foto por eso, dejamos el registro sin r2_key_display para que la
 * galería directamente muestre el original (más pesado, pero íntegro).
 */
export async function clearDisplayVersion(token: string, mediaId: string): Promise<{ ok: boolean; reason?: string }> {
  const resolved = await resolveToken(token);
  if (!resolved) return { ok: false, reason: 'Enlace inválido.' };
  const { album } = resolved;

  const supabase = getSupabaseAdmin();
  const { data: media, error } = await supabase
    .from('media')
    .select('id, album_id, r2_key_display')
    .eq('id', mediaId)
    .maybeSingle();
  if (error) throw error;
  if (!media || media.album_id !== album.id) return { ok: false, reason: 'Contenido no encontrado.' };

  if (media.r2_key_display) {
    await deleteObject(media.r2_key_display).catch(() => {});
  }

  const { error: updateError } = await supabase
    .from('media')
    .update({ r2_key_display: null, display_size_bytes: null })
    .eq('id', mediaId);
  if (updateError) throw updateError;

  return { ok: true };
}

export type RequestCoverUploadUrlResult =
  | { ok: true; uploadUrl: string; key: string }
  | { ok: false; reason: string };

/** Pide una URL prefirmada para subir/cambiar la imagen de portada del álbum. */
export async function requestCoverUploadUrl(
  token: string,
  input: { contentType: string; sizeBytes: number }
): Promise<RequestCoverUploadUrlResult> {
  const resolved = await resolveToken(token);
  if (!resolved) return { ok: false, reason: 'Enlace inválido.' };
  const { role, album } = resolved;

  if (role !== 'organizer' && role !== 'moderator') {
    return { ok: false, reason: 'No tenés permiso para cambiar la portada de este álbum.' };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(input.contentType)) {
    return { ok: false, reason: 'Formato de imagen no soportado para la portada.' };
  }
  if (input.sizeBytes > MAX_COVER_IMAGE_BYTES) {
    return { ok: false, reason: 'La imagen de portada no puede pesar más de 8 MB.' };
  }

  const extension = input.contentType.split('/')[1] ?? 'jpg';
  // Sufijo único (no reusa el nombre anterior) para poder mostrar la portada
  // vieja hasta que la nueva termine de subirse, sin pisarla a medio camino.
  const key = `albums/${album.id}/cover-${Date.now()}.${extension}`;
  const uploadUrl = await createUploadUrl(key, input.contentType);

  return { ok: true, uploadUrl, key };
}

/** Confirma que la portada ya se subió a R2 y la deja activa en el álbum. */
export async function confirmCoverImage(token: string, key: string): Promise<{ ok: boolean; reason?: string }> {
  const resolved = await resolveToken(token);
  if (!resolved) return { ok: false, reason: 'Enlace inválido.' };
  const { role, album } = resolved;

  if (role !== 'organizer' && role !== 'moderator') {
    return { ok: false, reason: 'No tenés permiso para cambiar la portada de este álbum.' };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('albums').update({ cover_image_key: key }).eq('id', album.id);
  if (error) throw error;

  const previousKey = album.cover_image_key;
  if (previousKey && previousKey !== key) {
    await deleteObject(previousKey).catch(() => {});
  }

  return { ok: true };
}

/** Saca la portada del álbum (vuelve a no tener). */
export async function removeCoverImage(token: string): Promise<{ ok: boolean; reason?: string }> {
  const resolved = await resolveToken(token);
  if (!resolved) return { ok: false, reason: 'Enlace inválido.' };
  const { role, album } = resolved;

  if (role !== 'organizer' && role !== 'moderator') {
    return { ok: false, reason: 'No tenés permiso para cambiar la portada de este álbum.' };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('albums').update({ cover_image_key: null }).eq('id', album.id);
  if (error) throw error;

  if (album.cover_image_key) {
    await deleteObject(album.cover_image_key).catch(() => {});
  }

  return { ok: true };
}

export async function deleteMedia(
  token: string,
  mediaId: string,
  requestingDeviceId?: string
): Promise<{ ok: boolean; reason?: string }> {
  const resolved = await resolveToken(token);
  if (!resolved) return { ok: false, reason: 'Enlace inválido.' };
  const { role, album } = resolved;

  const supabase = getSupabaseAdmin();
  const { data: media, error } = await supabase.from('media').select('*').eq('id', mediaId).maybeSingle();
  if (error) throw error;
  if (!media || media.album_id !== album.id) return { ok: false, reason: 'Contenido no encontrado.' };

  const isModerator = role === 'organizer' || role === 'moderator';
  const isOwnUpload =
    media.uploaded_by_token === token &&
    !!media.uploader_device_id &&
    media.uploader_device_id === requestingDeviceId;
  if (!isModerator && !isOwnUpload) {
    return { ok: false, reason: 'Solo podés borrar tus propias fotos/videos.' };
  }

  await deleteObject(media.r2_key);
  if (media.r2_key_display) {
    await deleteObject(media.r2_key_display).catch(() => {});
  }
  const { error: deleteError } = await supabase.from('media').delete().eq('id', mediaId);
  if (deleteError) throw deleteError;

  return { ok: true };
}

export async function toggleLike(
  mediaId: string,
  deviceId: string
): Promise<{ ok: boolean; liked?: boolean; likeCount?: number; reason?: string }> {
  if (!deviceId) return { ok: false, reason: 'Falta identificar el dispositivo.' };

  const supabase = getSupabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from('media_likes')
    .select('media_id')
    .eq('media_id', mediaId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error: deleteError } = await supabase
      .from('media_likes')
      .delete()
      .eq('media_id', mediaId)
      .eq('device_id', deviceId);
    if (deleteError) throw deleteError;
  } else {
    const { error: insertError } = await supabase.from('media_likes').insert({ media_id: mediaId, device_id: deviceId });
    if (insertError) throw insertError;
  }

  const { count, error: countError } = await supabase
    .from('media_likes')
    .select('media_id', { count: 'exact', head: true })
    .eq('media_id', mediaId);
  if (countError) throw countError;

  return { ok: true, liked: !existing, likeCount: count ?? 0 };
}

export async function closeAlbum(token: string): Promise<{ ok: boolean; reason?: string }> {
  const resolved = await resolveToken(token);
  if (!resolved) return { ok: false, reason: 'Enlace inválido.' };
  const { role, album } = resolved;

  if (role !== 'organizer' && role !== 'moderator') {
    return { ok: false, reason: 'No tenés permiso para cerrar este álbum.' };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('albums').update({ status: 'closed' }).eq('id', album.id);
  if (error) throw error;

  return { ok: true };
}
