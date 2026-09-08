'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlbumViewModel } from '@/lib/albums';

const DEVICE_ID_KEY = 'event-album:device-id';

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

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject(new Error('No se pudo leer el video.'));
    video.src = URL.createObjectURL(file);
  });
}

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';
interface UploadItem {
  key: string;
  name: string;
  status: UploadStatus;
  error?: string;
}

type MediaItem = AlbumViewModel['media'][number];

export default function AlbumWorkspace({ token, initialView }: { token: string; initialView: AlbumViewModel }) {
  const [view, setView] = useState(initialView);
  const [deviceId, setDeviceId] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  async function refreshView() {
    const res = await fetch(`/api/albums/${token}`, { cache: 'no-store' });
    if (res.ok) setView(await res.json());
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    for (const file of files) {
      const itemKey = `${file.name}-${file.size}-${Date.now()}`;
      setUploads((prev) => [...prev, { key: itemKey, name: file.name, status: 'uploading' }]);

      try {
        let durationSeconds: number | undefined;
        if (file.type.startsWith('video/')) {
          durationSeconds = await readVideoDuration(file);
        }

        const urlRes = await fetch(`/api/albums/${token}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: file.type,
            sizeBytes: file.size,
            durationSeconds,
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

        setUploads((prev) => prev.map((u) => (u.key === itemKey ? { ...u, status: 'done' } : u)));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inesperado.';
        setUploads((prev) => prev.map((u) => (u.key === itemKey ? { ...u, status: 'error', error: message } : u)));
      }
    }

    await refreshView();
  }

  async function handleDelete(mediaId: string) {
    const res = await fetch(`/api/media/${mediaId}?token=${token}&deviceId=${deviceId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? 'No se pudo borrar.');
      return;
    }
    setLightboxIndex(null);
    await refreshView();
  }

  async function handleClose() {
    if (!confirm('¿Cerrar el álbum? No se van a poder subir más fotos ni videos.')) return;
    const res = await fetch(`/api/albums/${token}/close`, { method: 'POST' });
    if (res.ok) await refreshView();
  }

  const { album, role, windows, storageUsedBytes, canUpload, canModerate, media } = view;
  const storagePercent = Math.min(100, (storageUsedBytes / album.storage_limit_bytes) * 100);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl italic text-brand-dark">{album.name}</h1>
        <p className="text-sm text-gray-500">
          {[formatDate(album.event_date), album.location].filter(Boolean).join(' · ') || 'Sin fecha/lugar'}
        </p>
        <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
          Tu rol: {role === 'organizer' ? 'Organizador' : role === 'moderator' ? 'Moderador' : role === 'contributor' ? 'Invitado (podés subir)' : 'Solo ver'}
        </p>
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

      {canUpload && (
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            📷 Sacar foto/video
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 rounded-lg border border-brand py-2.5 text-sm font-semibold text-brand hover:bg-purple-50"
          >
            🖼️ Subir de la galería
          </button>
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
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="mb-6 space-y-1 text-xs">
          {uploads.map((u) => (
            <li key={u.key} className={u.status === 'error' ? 'text-red-600' : 'text-gray-500'}>
              {u.name} —{' '}
              {u.status === 'uploading' ? 'subiendo…' : u.status === 'done' ? 'listo ✓' : `error: ${u.error}`}
            </li>
          ))}
        </ul>
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

      {media.length > 0 && (
        <p className="mb-3 text-xs uppercase tracking-wide text-gray-400">
          {media.length} {media.length === 1 ? 'momento' : 'momentos'} · tocá una foto para verla en grande
        </p>
      )}

      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4">
        {media.map((item, index) => {
          const canDelete = canModerate || item.uploader_device_id === deviceId;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setLightboxIndex(index)}
              onKeyDown={(e) => e.key === 'Enter' && setLightboxIndex(index)}
              className="group relative mb-3 block w-full cursor-zoom-in overflow-hidden rounded-xl bg-gray-100 shadow-sm sm:mb-4"
            >
              {item.kind === 'photo' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.viewUrl}
                  alt=""
                  loading="lazy"
                  className="block h-auto w-full object-cover transition duration-300 ease-out group-hover:scale-[1.03]"
                />
              ) : (
                <div className="relative">
                  <video src={item.viewUrl} muted preload="metadata" className="block h-auto w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition group-hover:scale-110">
                      ▶
                    </span>
                  </span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('¿Borrar esta foto/video?')) handleDelete(item.id);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
                >
                  Borrar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {media.length === 0 && !windows.isArchived && (
        <p className="mt-8 text-center text-sm text-gray-400">Todavía no hay fotos ni videos en este álbum.</p>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          media={media}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDelete={
            canModerate || media[lightboxIndex]?.uploader_device_id === deviceId ? handleDelete : undefined
          }
        />
      )}
    </main>
  );
}

function Lightbox({
  media,
  index,
  onClose,
  onNavigate,
  onDelete,
}: {
  media: MediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDelete?: (mediaId: string) => void;
}) {
  const item = media[index];

  const goTo = useCallback(
    (delta: number) => {
      const next = (index + delta + media.length) % media.length;
      onNavigate(next);
    },
    [index, media.length, onNavigate]
  );

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
      >
        ✕
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

      <div
        className="flex max-h-[85vh] max-w-[92vw] flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.viewUrl}
            alt=""
            className="max-h-[75vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <video
            src={item.viewUrl}
            controls
            autoPlay
            className="max-h-[75vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
        )}

        <div className="flex items-center gap-3">
          <a
            href={item.downloadUrl}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-dark shadow hover:bg-white/90"
          >
            ⬇ Descargar
          </a>
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('¿Borrar esta foto/video?')) onDelete(item.id);
              }}
              className="rounded-full border border-white/30 px-5 py-2 text-sm font-medium text-white hover:bg-white/10"
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
