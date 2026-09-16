'use client';

import { useState } from 'react';
import type { BrandKey } from '@/lib/brands';
import { LANDING_STRINGS, type Lang } from '@/lib/i18n';
import AlbumLinksView from './AlbumLinksView';

interface CreateAlbumResponse {
  albumId: string;
  links: Record<'organizer' | 'contributor' | 'viewer', string>;
}

export default function CreateAlbumForm({ brand = 'vivido', lang = 'es' }: { brand?: BrandKey; lang?: Lang }) {
  const t = LANDING_STRINGS[lang];
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateAlbumResponse | null>(null);

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

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm font-medium text-green-700">{t.createdTitle}</p>
        <AlbumLinksView albumName={name} brand={brand} lang={lang} links={result.links} />
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
