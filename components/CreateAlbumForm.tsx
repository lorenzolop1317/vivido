'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import QRCode from 'qrcode';
import type { BrandKey } from '@/lib/brands';
import { LANDING_STRINGS, type Lang } from '@/lib/i18n';

// Carga diferida: InviteEmailPanel arrastra la librería de lectura de Excel,
// que solo hace falta si el organizador realmente sube una lista de
// invitados. Así no infla el JS que se descarga solo para crear el álbum.
const InviteEmailPanel = dynamic(() => import('./InviteEmailPanel'), { ssr: false });

interface CreateAlbumResponse {
  albumId: string;
  links: Record<'organizer' | 'contributor' | 'viewer', string>;
}

export default function CreateAlbumForm({ brand = 'vivido', lang = 'es' }: { brand?: BrandKey; lang?: Lang }) {
  const t = LANDING_STRINGS[lang];
  const roleLabels: Record<keyof CreateAlbumResponse['links'], { title: string; hint: string }> = {
    organizer: { title: t.roleOrganizerTitle, hint: t.roleOrganizerHint },
    contributor: { title: t.roleContributorTitle, hint: t.roleContributorHint },
    viewer: { title: t.roleViewerTitle, hint: t.roleViewerHint },
  };
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateAlbumResponse | null>(null);
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [qrOpenRole, setQrOpenRole] = useState<string | null>(null);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, eventDate: eventDate || null, location: location || null, brand }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.createError);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.unexpectedError);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(role: string, path: string) {
    const fullUrl = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedRole(role);
    setTimeout(() => setCopiedRole(null), 2000);
  }

  async function toggleQr(role: string, path: string) {
    if (qrOpenRole === role) {
      setQrOpenRole(null);
      return;
    }
    if (!qrDataUrls[role]) {
      const fullUrl = `${window.location.origin}${path}`;
      const dataUrl = await QRCode.toDataURL(fullUrl, { width: 480, margin: 1 });
      setQrDataUrls((prev) => ({ ...prev, [role]: dataUrl }));
    }
    setQrOpenRole(role);
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm font-medium text-green-700">{t.createdTitle}</p>
        {(Object.keys(result.links) as Array<keyof CreateAlbumResponse['links']>).map((role) => (
          <div key={role} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-brand-dark">{roleLabels[role].title}</p>
            <p className="mt-1 text-xs text-gray-500">{roleLabels[role].hint}</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                {result.links[role]}
              </code>
              <button
                onClick={() => copyLink(role, result.links[role])}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
              >
                {copiedRole === role ? t.copiedButton : t.copyButton}
              </button>
              {role === 'contributor' && (
                <button
                  onClick={() => toggleQr(role, result.links[role])}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {qrOpenRole === role ? t.hideQr : t.showQr}
                </button>
              )}
            </div>
            {role === 'contributor' && qrOpenRole === role && qrDataUrls[role] && (
              <div className="mt-3 flex flex-col items-center gap-2 border-t border-gray-100 pt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrls[role]} alt={roleLabels.contributor.title} className="h-40 w-40" />
                <p className="text-center text-xs text-gray-500">{t.qrHint}</p>
                <a
                  href={qrDataUrls[role]}
                  download={`qr-invitados-${name || 'album'}.png`}
                  className="text-xs font-medium text-brand underline hover:text-brand-dark"
                >
                  {t.downloadQr}
                </a>
              </div>
            )}
          </div>
        ))}
        <InviteEmailPanel organizerToken={result.links.organizer.replace('/a/', '')} albumName={name} brand={brand} lang={lang} />
        <p className="pt-2 text-center text-xs text-gray-400">{t.planInfo}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700">{t.eventNameLabel}</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={brand === 'divine_tables' ? t.eventNamePlaceholder : 'Cumple de Sofía'}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">{t.eventDateLabel}</label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">{t.eventLocationLabel}</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={brand === 'divine_tables' ? t.eventLocationPlaceholder : 'Salón Los Álamos'}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {loading ? t.creatingButton : t.createButton}
      </button>
    </form>
  );
}
