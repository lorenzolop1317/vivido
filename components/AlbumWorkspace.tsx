'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlbumViewModel, MediaItem } from '@/lib/albums';

const DEVICE_ID_KEY = 'event-album:device-id';
const PAGE_SIZE = 30;

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = URL.createObjectURL(file);
  });
}

function readVideoMeta(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => reject(new Error('No se pudo leer el video.'));
    video.src = URL.createObjectURL(file);
  });
}

/* ---------- Íconos (SVG a mano, sin librerías externas) ---------- */

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.65a1.5 1.5 0 0 0 1.28-.72l.7-1.14A1.5 1.5 0 0 1 10.4 4.5h3.2a1.5 1.5 0 0 1 1.27.72l.7 1.14a1.5 1.5 0 0 0 1.28.72H18.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" strokeLinejoin="round" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

function ImagesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3.5" y="6.5" width="13" height="13" rx="2" />
      <path d="M7.5 6.5V5A1.5 1.5 0 0 1 9 3.5h9A1.5 1.5 0 0 1 19.5 5v9a1.5 1.5 0 0 1-1.5 1.5h-1.5" />
      <circle cx="8" cy="11" r="1.3" />
      <path d="M5 17.5l3-3.2a1.4 1.4 0 0 1 2 0l1 1.05 2.5-2.7a1.4 1.4 0 0 1 2.05.02L18 15.5" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" className={className}>
      <path
        d="M12 20s-6.7-4.03-9.3-8.24C1.06 9.2 1.9 5.9 4.98 4.86c2-.67 3.86.1 5.02 1.6l2 2.6 2-2.6c1.16-1.5 3.02-2.27 5.02-1.6 3.08 1.04 3.92 4.34 2.28 6.9C18.7 15.97 12 20 12 20Z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 4v10.5" strokeLinecap="round" />
      <path d="M7.5 11.5 12 16l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18.5h14" strokeLinecap="round" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className ?? ''}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Tipos ---------- */

type UploadStatus = 'uploading' | 'done' | 'error';
interface UploadItem {
  key: string;
  name: string;
  status: UploadStatus;
  error?: string;
}
interface UploadSummary {
  photos: number;
  videos: number;
  errors: number;
}
type UploadStage = 'idle' | 'uploading' | 'summary';

interface AlbumMeta {
  role: AlbumViewModel['role'];
  album: AlbumViewModel['album'];
  windows: AlbumViewModel['windows'];
  storageUsedBytes: number;
  canUpload: boolean;
  canModerate: boolean;
  mediaTotal: number;
}

export default function AlbumWorkspace({ token, initialView }: { token: string; initialView: AlbumViewModel }) {
  const [meta, setMeta] = useState<AlbumMeta>({
    role: initialView.role,
    album: initialView.album,
    windows: initialView.windows,
    storageUsedBytes: initialView.storageUsedBytes,
    canUpload: initialView.canUpload,
    canModerate: initialView.canModerate,
    mediaTotal: initialView.mediaTotal,
  });
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(initialView.media);
  const [hasMore, setHasMore] = useState(initialView.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function fetchPage(offset: number, limit: number, explicitDeviceId?: string): Promise<AlbumViewModel | null> {
    const id = explicitDeviceId ?? deviceId;
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (id) params.set('deviceId', id);
    const res = await fetch(`/api/albums/${token}?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  }

  // Al montar: identificamos el dispositivo y volvemos a pedir la primera
  // página ya con ese id, para que los likes/"lo mío" queden correctos
  // (en el render del servidor todavía no lo conocíamos).
  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);
    fetchPage(0, Math.max(initialView.media.length, PAGE_SIZE), id).then((data) => {
      if (!data) return;
      setMeta({
        role: data.role,
        album: data.album,
        windows: data.windows,
        storageUsedBytes: data.storageUsedBytes,
        canUpload: data.canUpload,
        canModerate: data.canModerate,
        mediaTotal: data.mediaTotal,
      });
      setMediaItems(data.media);
      setHasMore(data.hasMore);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const data = await fetchPage(mediaItems.length, PAGE_SIZE);
    if (data) {
      setMediaItems((prev) => [...prev, ...data.media]);
      setHasMore(data.hasMore);
      setMeta((prev) => ({ ...prev, storageUsedBytes: data.storageUsedBytes, mediaTotal: data.mediaTotal }));
    }
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, mediaItems.length, deviceId, token]);

  // Scroll infinito: cuando el "centinela" al final de la grilla entra en
  // pantalla, pedimos la próxima tanda de fotos.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '800px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Aviso antes de salir mientras hay una subida en curso, para no perder
  // el progreso por un "atrás" o un cierre accidental de la pestaña.
  useEffect(() => {
    const hasActiveUpload = uploads.some((u) => u.status === 'uploading');
    if (!hasActiveUpload) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploads]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setModalOpen(true);
    setUploadStage('uploading');
    setUploads(files.map((f) => ({ key: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, name: f.name, status: 'uploading' as const })));

    let photos = 0;
    let videos = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let durationSeconds: number | undefined;
        let width: number | undefined;
        let height: number | undefined;

        if (file.type.startsWith('video/')) {
          const meta = await readVideoMeta(file);
          durationSeconds = meta.duration;
          width = meta.width || undefined;
          height = meta.height || undefined;
        } else {
          const dims = await readImageDimensions(file).catch(() => null);
          if (dims) {
            width = dims.width;
            height = dims.height;
          }
        }

        const urlRes = await fetch(`/api/albums/${token}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: file.type,
            sizeBytes: file.size,
            durationSeconds,
            width,
            height,
            uploaderDeviceId: deviceId,
          }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error ?? 'No se pudo iniciar la subida.');

        const putRes = await fetch(urlData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error('Falló la subida a almacenamiento.');

        setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: 'done' } : u)));
        if (file.type.startsWith('video/')) videos += 1;
        else photos += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inesperado.';
        setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: 'error', error: message } : u)));
        errors += 1;
      }
    }

    const uploadedCount = photos + videos;
    if (uploadedCount > 0) {
      const fresh = await fetchPage(0, uploadedCount);
      if (fresh) {
        setMediaItems((prev) => {
          const newIds = new Set(fresh.media.map((m) => m.id));
          const merged = [...fresh.media, ...prev.filter((m) => !newIds.has(m.id))];
          setHasMore(fresh.mediaTotal > merged.length);
          return merged;
        });
        setMeta((prev) => ({ ...prev, storageUsedBytes: fresh.storageUsedBytes, mediaTotal: fresh.mediaTotal }));
      }
    }

    setUploadSummary({ photos, videos, errors });
    setUploadStage('summary');
  }

  function closeUploadModal() {
    setModalOpen(false);
    setUploadStage('idle');
    setUploads([]);
    setUploadSummary(null);
  }

  function triggerCamera() {
    cameraInputRef.current?.click();
  }

  function triggerGallery() {
    galleryInputRef.current?.click();
  }

  async function handleDelete(mediaId: string) {
    const res = await fetch(`/api/media/${mediaId}?token=${token}&deviceId=${deviceId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? 'No se pudo borrar.');
      return;
    }
    setLightboxIndex(null);
    setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
    setMeta((prev) => ({ ...prev, mediaTotal: Math.max(0, prev.mediaTotal - 1) }));
  }

  async function handleClose() {
    if (!confirm('¿Cerrar el álbum? No se van a poder subir más fotos ni videos.')) return;
    const res = await fetch(`/api/albums/${token}/close`, { method: 'POST' });
    if (res.ok) {
      const data = await fetchPage(0, mediaItems.length || PAGE_SIZE);
      if (data) setMeta((prev) => ({ ...prev, windows: data.windows, album: data.album }));
    }
  }

  async function handleToggleLike(mediaId: string) {
    if (!deviceId) return;
    setMediaItems((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, likedByMe: !m.likedByMe, likeCount: m.likeCount + (m.likedByMe ? -1 : 1) } : m))
    );
    try {
      const res = await fetch(`/api/media/${mediaId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMediaItems((prev) => prev.map((m) => (m.id === mediaId ? { ...m, likedByMe: data.liked, likeCount: data.likeCount } : m)));
      }
    } catch {
      // si falla la red, dejamos el estado optimista tal cual — no es crítico para un like
    }
  }

  const { album, role, windows, storageUsedBytes, canUpload, canModerate, mediaTotal } = meta;
  const storagePercent = Math.min(100, (storageUsedBytes / album.storage_limit_bytes) * 100);
  const uploadAvailable = canUpload && windows.uploadOpen;
  const showInlineCta = mediaTotal === 0 && uploadAvailable && !modalOpen;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif-title text-3xl text-brand-dark">{album.name}</h1>
          <p className="text-sm text-gray-500">
            {[formatDate(album.event_date), album.location].filter(Boolean).join(' · ') || 'Sin fecha/lugar'}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
            Tu rol: {role === 'organizer' ? 'Organizador' : role === 'moderator' ? 'Moderador' : role === 'contributor' ? 'Invitado (podés subir)' : 'Solo ver'}
          </p>
        </div>

        {mediaTotal > 0 && uploadAvailable && (
          <button
            onClick={() => {
              setModalOpen(true);
              setUploadStage('idle');
            }}
            className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-md"
          >
            <ImagesIcon className="h-4 w-4" />
            Cargar más fotos
          </button>
        )}
      </header>

      {windows.isArchived ? (
        <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Este álbum ya se archivó (pasó su ventana de retención de {album.retention_days} días) y su contenido
          ya no está disponible.
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatBytes(storageUsedBytes)} usados</span>
            <span>{formatBytes(album.storage_limit_bytes)} límite (plan gratis)</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-brand" style={{ width: `${storagePercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {windows.uploadOpen
              ? `Se puede seguir subiendo hasta el ${formatDate(windows.uploadClosesAt)}.`
              : 'La ventana para subir contenido ya cerró.'}
            {windows.viewableUntil && ` El álbum se archiva el ${formatDate(windows.viewableUntil)}.`}
          </p>
        </div>
      )}

      {canModerate && !windows.isArchived && (
        <div className="mb-6 flex gap-3">
          <a
            href={`/api/albums/${token}/export`}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Descargar todo (.zip)
          </a>
          {album.status === 'active' && (
            <button
              onClick={handleClose}
              className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Cerrar álbum
            </button>
          )}
        </div>
      )}

      {showInlineCta && (
        <div className="mb-8 rounded-2xl border border-dashed border-brand/30 bg-white/70 px-6 py-10 text-center">
          <p className="font-serif-title text-2xl text-brand-dark">Todavía no hay fotos ni videos</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Sé el/la primero/a en sumar un recuerdo de este evento. Cualquiera con este enlace puede subir.
          </p>
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
            <UploadEntryButton variant="primary" icon={<CameraIcon className="h-7 w-7" />} label="Sacar foto o video" onClick={triggerCamera} />
            <UploadEntryButton variant="secondary" icon={<ImagesIcon className="h-7 w-7" />} label="Elegir de la galería" onClick={triggerGallery} />
          </div>
        </div>
      )}

      {mediaTotal > 0 && (
        <p className="mb-3 text-xs uppercase tracking-wide text-gray-400">
          {mediaTotal} {mediaTotal === 1 ? 'momento' : 'momentos'} · tocá una foto para verla en grande
        </p>
      )}

      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4">
        {mediaItems.map((item, index) => {
          const canDelete = canModerate || item.uploader_device_id === deviceId;
          return (
            <Thumbnail
              key={item.id}
              item={item}
              canDelete={canDelete}
              onOpen={() => setLightboxIndex(index)}
              onToggleLike={() => handleToggleLike(item.id)}
              onDelete={() => {
                if (confirm('¿Borrar esta foto/video?')) handleDelete(item.id);
              }}
            />
          );
        })}
      </div>

      {(hasMore || loadingMore) && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <Spinner className="h-6 w-6 text-brand/60" />
        </div>
      )}

      {mediaTotal === 0 && !windows.isArchived && !uploadAvailable && (
        <p className="mt-8 text-center text-sm text-gray-400">Todavía no hay fotos ni videos en este álbum.</p>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          media={mediaItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onToggleLike={handleToggleLike}
          onDelete={
            canModerate || mediaItems[lightboxIndex]?.uploader_device_id === deviceId ? handleDelete : undefined
          }
        />
      )}

      {modalOpen && (
        <UploadModal
          stage={uploadStage}
          uploads={uploads}
          summary={uploadSummary}
          onTriggerCamera={triggerCamera}
          onTriggerGallery={triggerGallery}
          onClose={closeUploadModal}
        />
      )}
    </main>
  );
}

/* ---------- Miniatura con proporción fija + loader propio (sin "saltos") ---------- */

function Thumbnail({
  item,
  canDelete,
  onOpen,
  onToggleLike,
  onDelete,
}: {
  item: MediaItem;
  canDelete: boolean;
  onOpen: () => void;
  onToggleLike: () => void;
  onDelete: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : '4 / 3';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      style={{ aspectRatio: ratio }}
      className="group relative mb-3 block w-full cursor-zoom-in overflow-hidden rounded-xl bg-gray-100 shadow-sm sm:mb-4"
    >
      <div className={`skeleton-shimmer absolute inset-0 transition-opacity duration-300 ${loaded ? 'opacity-0' : 'opacity-100'}`} />

      {item.kind === 'photo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.viewUrl}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out group-hover:scale-[1.03] ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <>
          <video
            src={item.viewUrl}
            muted
            preload="metadata"
            onLoadedData={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {loaded && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition group-hover:scale-110">
                ▶
              </span>
            </span>
          )}
        </>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLike();
        }}
        className={`absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-sm transition sm:px-3.5 sm:py-2 sm:text-sm ${
          item.likedByMe ? 'bg-brand text-white' : 'bg-black/45 text-white hover:bg-black/60'
        }`}
      >
        <HeartIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" filled={item.likedByMe} />
        {item.likeCount > 0 && item.likeCount}
      </button>

      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
        >
          Borrar
        </button>
      )}
    </div>
  );
}

/* ---------- Botones de subida (compartidos entre el CTA inline y el modal) ---------- */

function UploadEntryButton({
  variant,
  icon,
  label,
  onClick,
}: {
  variant: 'primary' | 'secondary';
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const base = 'flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-6 text-sm font-semibold transition shadow-sm hover:shadow-md active:scale-[0.98]';
  const style =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-dark'
      : 'bg-white text-brand-dark ring-1 ring-inset ring-gray-200 hover:ring-brand/40';
  return (
    <button onClick={onClick} className={`${base} ${style}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ---------- Modal de subida: botones → progreso → resumen ---------- */

function UploadModal({
  stage,
  uploads,
  summary,
  onTriggerCamera,
  onTriggerGallery,
  onClose,
}: {
  stage: UploadStage;
  uploads: UploadItem[];
  summary: UploadSummary | null;
  onTriggerCamera: () => void;
  onTriggerGallery: () => void;
  onClose: () => void;
}) {
  const canClose = stage !== 'uploading';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => canClose && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif-title text-xl text-brand-dark">
            {stage === 'idle' && 'Sumar al álbum'}
            {stage === 'uploading' && 'Subiendo…'}
            {stage === 'summary' && '¡Listo!'}
          </h2>
          {canClose && (
            <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <XIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {stage === 'idle' && (
          <div className="grid grid-cols-2 gap-3">
            <UploadEntryButton variant="primary" icon={<CameraIcon className="h-7 w-7" />} label="Sacar foto o video" onClick={onTriggerCamera} />
            <UploadEntryButton variant="secondary" icon={<ImagesIcon className="h-7 w-7" />} label="Elegir de la galería" onClick={onTriggerGallery} />
          </div>
        )}

        {stage === 'uploading' && (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {uploads.map((u) => (
              <li key={u.key} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                {u.status === 'uploading' && <Spinner className="h-4 w-4 shrink-0 text-brand" />}
                {u.status === 'done' && <CheckIcon className="h-4 w-4 shrink-0 text-green-600" />}
                {u.status === 'error' && <XIcon className="h-4 w-4 shrink-0 text-red-500" />}
                <span className={`truncate ${u.status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                  {u.name}
                  {u.status === 'error' && u.error ? ` — ${u.error}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        {stage === 'summary' && summary && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              {summary.photos > 0 && (
                <>
                  {summary.photos} {summary.photos === 1 ? 'foto' : 'fotos'}
                </>
              )}
              {summary.photos > 0 && summary.videos > 0 && ' y '}
              {summary.videos > 0 && (
                <>
                  {summary.videos} {summary.videos === 1 ? 'video' : 'videos'}
                </>
              )}
              {summary.photos + summary.videos > 0 ? ' subidos correctamente.' : 'No se subió nada.'}
            </p>
            {summary.errors > 0 && (
              <p className="mt-1 text-sm text-red-600">
                {summary.errors} {summary.errors === 1 ? 'archivo falló' : 'archivos fallaron'}.
              </p>
            )}
            <button onClick={onClose} className="mt-5 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
              Volver al álbum
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Visor en popup (lightbox) ---------- */

function Lightbox({
  media,
  index,
  onClose,
  onNavigate,
  onToggleLike,
  onDelete,
}: {
  media: MediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onToggleLike: (mediaId: string) => void;
  onDelete?: (mediaId: string) => void;
}) {
  const item = media[index];
  const [loaded, setLoaded] = useState(false);

  const goTo = useCallback(
    (delta: number) => {
      const next = (index + delta + media.length) % media.length;
      onNavigate(next);
    },
    [index, media.length, onNavigate]
  );

  useEffect(() => {
    setLoaded(false);
  }, [index]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goTo(1);
      if (e.key === 'ArrowLeft') goTo(-1);
    }
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [goTo, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={onClose}>
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner className="h-10 w-10 text-white/60" />
        </div>
      )}

      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <XIcon className="h-5 w-5" />
      </button>

      {media.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goTo(-1);
            }}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:left-4"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goTo(1);
            }}
            aria-label="Siguiente"
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20 sm:right-4"
          >
            ›
          </button>
        </>
      )}

      <div className="relative z-[1] flex max-h-[85vh] max-w-[92vw] flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        {item.kind === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.viewUrl}
            alt=""
            onLoad={() => setLoaded(true)}
            className={`max-h-[75vh] max-w-[92vw] rounded-lg object-contain shadow-2xl transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <video
            src={item.viewUrl}
            controls
            autoPlay
            onLoadedData={() => setLoaded(true)}
            className={`max-h-[75vh] max-w-[92vw] rounded-lg object-contain shadow-2xl transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onToggleLike(item.id)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
              item.likedByMe ? 'bg-brand text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <HeartIcon className="h-4 w-4" filled={item.likedByMe} />
            {item.likeCount > 0 ? item.likeCount : 'Me gusta'}
          </button>
          <a
            href={item.downloadUrl}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-dark shadow hover:bg-white/90"
          >
            <DownloadIcon className="h-4 w-4" />
            Descargar
          </a>
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('¿Borrar esta foto/video?')) onDelete(item.id);
              }}
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Borrar
            </button>
          )}
          {media.length > 1 && (
            <span className="text-xs text-white/60">
              {index + 1} / {media.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
