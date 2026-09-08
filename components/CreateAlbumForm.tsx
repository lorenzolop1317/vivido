'use client';

import { useState } from 'react';

interface CreateAlbumResponse {
  albumId: string;
  links: Record<'organizer' | 'contributor' | 'viewer', string>;
}

const roleLabels: Record<keyof CreateAlbumResponse['links'], { title: string; hint: string }> = {
  organizer: {
    title: 'Tu enlace (organizador)',
    hint: 'Guardalo para vos: modera, cierra y descarga el álbum. No lo compartas.',
  },
  contributor: {
    title: 'Enlace para invitados',
    hint: 'Compartilo por WhatsApp o donde quieras: cualquiera que lo abra puede subir fotos/videos.',
  },
  viewer: {
    title: 'Enlace solo para ver',
    hint: 'Para quien solo quiere mirar el álbum, sin subir nada.',
  },
};

export default function CreateAlbumForm() {
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateAlbumResponse | null>(null);
  const [copiedRole, setCopiedRole] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, eventDate: eventDate || null, location: location || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear el álbum.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
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

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm font-medium text-green-700">¡Álbum creado! Guardá estos enlaces.</p>
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
                {copiedRole === role ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        ))}
        <p className="pt-2 text-center text-xs text-gray-400">
          Plan gratis: 3 GB, videos hasta 60s, 14 días para subir, 30 días de retención total.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre del evento</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cumple de Sofía"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Fecha (opcional)</label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Lugar (opcional)</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Salón Los Álamos"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {loading ? 'Creando…' : 'Crear álbum'}
      </button>
    </form>
  );
}
