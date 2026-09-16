'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminAlbumSummary } from '@/lib/albums';
import { BRANDS, type BrandKey } from '@/lib/brands';
import { INFRA_FREE_TIER } from '@/lib/limits';

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
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
// Mismos topes de sanidad que valida el servidor (lib/albums.ts,
// setAlbumStorageLimit) — se usan acá solo para no dejar mandar un valor que
// el servidor va a rechazar igual.
const MIN_STORAGE_LIMIT_MB = 512;
const MAX_STORAGE_LIMIT_MB = 20 * 1024;

type BrandFilter = 'all' | BrandKey;

export default function AdminDashboard({ initialAlbums }: { initialAlbums: AdminAlbumSummary[] }) {
  const router = useRouter();
  const [albums, setAlbums] = useState(initialAlbums);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [storageUnit, setStorageUnit] = useState<'GB' | 'MB'>('GB');

  const filtered = useMemo(
    () => (brandFilter === 'all' ? albums : albums.filter((a) => a.brand === brandFilter)),
    [albums, brandFilter]
  );

  const totals = useMemo(
    () => ({
      count: albums.length,
      storage: albums.reduce((sum, a) => sum + a.storageUsedBytes, 0),
      retentionOn: albums.filter((a) => a.retention_enabled).length,
    }),
    [albums]
  );
  const storagePercent = Math.min(100, (totals.storage / INFRA_FREE_TIER.r2StorageBytes) * 100);

  // Si la cookie de sesión venció o se invalidó (ej. cambiaste ADMIN_SECRET),
  // cualquier pedido a estas rutas devuelve 401 — en ese caso recargamos para
  // que vuelva a aparecer la pantalla de login, en vez de dejar el panel
  // mostrando datos viejos como si nada.
  function handleUnauthorized() {
    router.refresh();
  }

  async function refresh() {
    const res = await fetch('/api/admin/albums', { cache: 'no-store' });
    if (res.status === 401) return handleUnauthorized();
    if (res.ok) {
      const data = await res.json();
      setAlbums(data.albums);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    router.refresh();
  }

  async function toggleRetention(album: AdminAlbumSummary) {
    setError(null);
    setPendingId(album.id);
    const next = !album.retention_enabled;
    // Optimista: se ve el cambio al toque, y si falla se revierte.
    setAlbums((prev) => prev.map((a) => (a.id === album.id ? { ...a, retention_enabled: next } : a)));
    try {
      const res = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionEnabled: next }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'No se pudo actualizar.');
      }
    } catch (err) {
      setAlbums((prev) => prev.map((a) => (a.id === album.id ? { ...a, retention_enabled: !next } : a)));
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(album: AdminAlbumSummary) {
    const typed = window.prompt(
      `Esto borra "${album.name}" por completo: todas las fotos/videos en almacenamiento y el álbum entero. No se puede deshacer.\n\nEscribí BORRAR para confirmar.`
    );
    if (typed !== 'BORRAR') return;

    setError(null);
    setPendingId(album.id);
    try {
      const res = await fetch(`/api/admin/albums/${album.id}`, { method: 'DELETE' });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'No se pudo borrar.');
      }
      setAlbums((prev) => prev.filter((a) => a.id !== album.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setPendingId(null);
    }
  }

  async function updateStorageLimit(album: AdminAlbumSummary, bytes: number) {
    setError(null);
    setPendingId(album.id);
    const prevLimit = album.storageLimitBytes;
    // Optimista, igual que toggleRetention.
    setAlbums((prev) => prev.map((a) => (a.id === album.id ? { ...a, storageLimitBytes: bytes } : a)));
    try {
      const res = await fetch(`/api/admin/albums/${album.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageLimitBytes: bytes }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'No se pudo actualizar.');
      }
    } catch (err) {
      setAlbums((prev) => prev.map((a) => (a.id === album.id ? { ...a, storageLimitBytes: prevLimit } : a)));
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setPendingId(null);
    }
  }

  async function copyOrganizerLink(album: AdminAlbumSummary) {
    if (!album.organizerLink) return;
    const fullUrl = `${window.location.origin}${album.organizerLink}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedId(album.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel de super usuario</h1>
            <p className="mt-1 text-sm text-gray-500">
              {totals.count} {totals.count === 1 ? 'álbum' : 'álbumes'} · {totals.retentionOn} con auto-borrado activado
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/vivido"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              + Álbum Vívido
            </a>
            <a
              href="/divine-tables"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              + Álbum Divine Tables
            </a>
            <button
              onClick={refresh}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Actualizar
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span className="font-medium text-gray-900">Espacio usado (todos los álbumes)</span>
            <span>
              {formatBytes(totals.storage)} de {formatBytes(INFRA_FREE_TIER.r2StorageBytes)} (capa gratis de Cloudflare R2)
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full transition-all ${storagePercent > 85 ? 'bg-red-500' : storagePercent > 60 ? 'bg-amber-500' : 'bg-brand'}`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Estimado a partir de lo que suman todos los álbumes (fotos/videos originales + copias livianas) — no es
            una consulta en vivo a la facturación de Cloudflare, pero sí es el mismo número que usa la app para
            frenar nuevas subidas: si dejarían pasar estos {formatBytes(INFRA_FREE_TIER.r2StorageBytes)}, se
            rechazan automáticamente (en cualquier álbum, de cualquier marca) hasta que liberes espacio.
          </p>
        </div>

        <div className="mb-5 flex gap-2">
          {(['all', 'vivido', 'divine_tables'] as BrandFilter[]).map((key) => (
            <button
              key={key}
              onClick={() => setBrandFilter(key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                brandFilter === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-100'
              }`}
            >
              {key === 'all' ? 'Todas las marcas' : BRANDS[key].name}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
              No hay álbumes para mostrar.
            </p>
          )}

          {filtered.map((album) => {
            const busy = pendingId === album.id;
            return (
              <div key={album.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-gray-900">{album.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                          album.brand === 'divine_tables' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {BRANDS[album.brand].name}
                      </span>
                      {album.windows.isArchived && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
                          Archivado
                        </span>
                      )}
                      {album.status === 'closed' && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">
                          Cerrado
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {[formatDate(album.event_date), album.location].filter(Boolean).join(' · ') || 'Sin fecha/lugar'} · creado el{' '}
                      {formatDate(album.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatBytes(album.storageUsedBytes)} de {formatBytes(album.storageLimitBytes)} · {album.mediaCount}{' '}
                      {album.mediaCount === 1 ? 'archivo' : 'archivos'}
                      {album.retention_enabled && album.windows.viewableUntil && (
                        <> · se archiva el {formatDate(album.windows.viewableUntil)}</>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {album.organizerLink && (
                      <>
                        <a
                          href={`/links/${album.organizerLink.replace('/a/', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Enlaces Web
                        </a>
                        <a
                          href={`/api/albums/${album.organizerLink.replace('/a/', '')}/export`}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Download Data
                        </a>
                        <button
                          onClick={() => copyOrganizerLink(album)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          {copiedId === album.id ? 'Copiado' : 'Copiar enlace organizador'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(album)}
                      disabled={busy}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Borrar todo
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex w-fit items-center gap-2.5 text-sm text-gray-700">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={album.retention_enabled}
                      onClick={() => toggleRetention(album)}
                      disabled={busy}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                        album.retention_enabled ? 'bg-brand' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          album.retention_enabled ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                    Auto-borrado por antigüedad {album.retention_enabled ? 'activado' : 'desactivado'}
                    {album.retention_days != null && (
                      <span className="text-xs text-gray-400">({album.retention_days} días)</span>
                    )}
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    Tope de este álbum
                    <input
                      key={`${album.id}-${album.storageLimitBytes}-${storageUnit}`}
                      type="number"
                      min={storageUnit === 'GB' ? MIN_STORAGE_LIMIT_MB / 1024 : MIN_STORAGE_LIMIT_MB}
                      max={storageUnit === 'GB' ? MAX_STORAGE_LIMIT_MB / 1024 : MAX_STORAGE_LIMIT_MB}
                      step={storageUnit === 'GB' ? 1 : 50}
                      defaultValue={
                        storageUnit === 'GB'
                          ? Math.round((album.storageLimitBytes / GB) * 10) / 10
                          : Math.round(album.storageLimitBytes / MB)
                      }
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        const bytes = Math.round(value * (storageUnit === 'GB' ? GB : MB));
                        const minBytes = MIN_STORAGE_LIMIT_MB * MB;
                        const maxBytes = MAX_STORAGE_LIMIT_MB * MB;
                        if (!Number.isFinite(value) || bytes < minBytes || bytes > maxBytes) {
                          setError(
                            `El tope tiene que estar entre ${MIN_STORAGE_LIMIT_MB} MB y ${MAX_STORAGE_LIMIT_MB / 1024} GB.`
                          );
                          e.target.value = String(
                            storageUnit === 'GB' ? album.storageLimitBytes / GB : Math.round(album.storageLimitBytes / MB)
                          );
                          return;
                        }
                        if (bytes !== album.storageLimitBytes) updateStorageLimit(album, bytes);
                      }}
                      className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
                    />
                    <select
                      value={storageUnit}
                      onChange={(e) => setStorageUnit(e.target.value as 'GB' | 'MB')}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="GB">GB</option>
                      <option value="MB">MB</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
