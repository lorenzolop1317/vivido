'use client';

import type { Lang } from '@/lib/i18n';

/** Selector chico ES/EN — se usa solo en las pantallas de Divine Tables. */
export default function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <div className="inline-flex rounded-full border border-gray-300 bg-white p-0.5 text-xs font-semibold">
      {(['es', 'en'] as Lang[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-full px-2.5 py-1 transition ${
            lang === key ? 'bg-brand text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {key.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
