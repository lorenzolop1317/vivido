import { getSupabaseAdmin } from './supabase';
import { createUploadUrl, createViewUrl, createDownloadUrl, deleteObject } from './r2';
import { generateAccessToken } from './tokens';
import { FREE_PLAN, kindForContentType } from './limits';

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
  created_at: string;
}

export interface MediaRow {
  id: string;
  album_id: string;
  r2_key: string;
  kind: 'photo' | 'video';
  content_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  uploaded_by_token: string | null;
  uploader_device_id: string | null;
  uploader_label: string | null;
  created_at: string;
}

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
  const { data, error } = await supabase.from('media').select('size_bytes').eq('album_id', albumId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.size_bytes), 0);
}

export interface AlbumViewModel {
  role: AlbumRole;
  album: AlbumRow;
  windows: AlbumWindows;
  storageUsedBytes: number;
  canUpload: boolean;
  canModerate: boolean; // borrar cualquier contenido, cerrar álbum, exportar
  media: Array<MediaRow & { viewUrl: string; downloadUrl: string; likeCount: number; likedByMe: boolean }>;
}

export async function getAlbumView(token: string, deviceId?: string | null): Promise<AlbumViewModel | null> {
  const resolved = await resolveToken(token);
  if (!resolved) return null;
  const { role, album } = resolved;

  const supabase = getSupabaseAdmin();
  const { data: mediaRows, error } = await supabase
    .from('media')
    .select('*')
    .eq('album_id', album.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const windows = computeWindows(album);
  const storageUsedBytes = (mediaRows ?? []).reduce((sum, row) => sum + Number(row.size_bytes), 0);

  const mediaIds = (mediaRows ?? []).map((row) => row.id);
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

  const media = await Promise.all(
    (mediaRows ?? []).map(async (row) => ({
      ...(row as MediaRow),
      viewUrl: windows.isArchived ? '' : await createViewUrl(row.r2_key),
      downloadUrl: windows.isArchived
        ? ''
        : await createDownloadUrl(row.r2_key, downloadFilename(album.name, row.id, row.content_type)),
      likeCount: likeCounts.get(row.id) ?? 0,
      likedByMe: likedByMeSet.has(row.id),
    }))
  );

  return {
    role,
    album,
    windows,
    storageUsedBytes,
    canUpload: (role === 'organizer' || role === 'moderator' || role === 'contributor') && windows.uploadOpen,
    canModerate: role === 'organizer' || role === 'moderator',
    media,
  };
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
  | { ok: true; uploadUrl: string; mediaId: string }
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

  const used = await getStorageUsedBytes(album.id);
  if (used + input.sizeBytes > album.storage_limit_bytes) {
    return { ok: false, reason: 'El álbum llegó a su límite de almacenamiento del plan gratis.' };
  }

  const supabase = getSupabaseAdmin();
  const { data: mediaRow, error } = await supabase
    .from('media')
    .insert({
      album_id: album.id,
      r2_key: '', // se completa abajo, necesitamos el id primero para armar la key
      kind,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      duration_seconds: input.durationSeconds ?? null,
      uploaded_by_token: token,
      uploader_device_id: input.uploaderDeviceId ?? null,
      uploader_label: input.uploaderLabel ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const extension = input.contentType.split('/')[1] ?? 'bin';
  const key = `albums/${album.id}/${mediaRow.id}.${extension}`;

  const { error: updateError } = await supabase.from('media').update({ r2_key: key }).eq('id', mediaRow.id);
  if (updateError) throw updateError;

  const uploadUrl = await createUploadUrl(key, input.contentType);

  return { ok: true, uploadUrl, mediaId: mediaRow.id };
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
