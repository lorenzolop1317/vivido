'use client';

import { useEffect, useState } from 'react';
import CreateAlbumForm from './CreateAlbumForm';
import Footer from './Footer';
import BrandTheme from './BrandTheme';
import LanguageToggle from './LanguageToggle';
import { BRANDS } from '@/lib/brands';
import { getStoredLang, setStoredLang, type Lang } from '@/lib/i18n';

const config = BRANDS.divine_tables;

const TAGLINE: Record<Lang, string> = {
  es: config.tagline,
  en: 'It’s not just a table.. it’s a moment. Share your event photos in one album, no apps or login needed.',
};

export default function DivineTablesHome() {
  const [lang, setLang] = useState<Lang>('es');

  // Arranca en español (igual que el render del servidor) y, apenas monta en
  // el navegador, adopta la preferencia guardada — así no hay parpadeo raro
  // de idioma en la carga inicial ni desajuste entre servidor y cliente.
  useEffect(() => {
    setLang(getStoredLang());
  }, []);

  function handleChangeLang(next: Lang) {
    setLang(next);
    setStoredLang(next);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BrandTheme brand="divine_tables" />
      <main className="mx-auto flex flex-1 w-full max-w-lg flex-col justify-center px-6 py-12">
        <div className="mb-4 flex justify-end">
          <LanguageToggle lang={lang} onChange={handleChangeLang} />
        </div>
        <div className="mb-8 text-center">
          {config.logoLockup ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoLockup} alt={config.name} className="mx-auto h-28 w-auto sm:h-32 md:h-40" />
          ) : (
            <h1 className="font-display text-4xl text-brand-dark">{config.name}</h1>
          )}
          <p className="mt-3 text-sm text-gray-600">{TAGLINE[lang]}</p>
        </div>
        <CreateAlbumForm brand="divine_tables" lang={lang} />
      </main>
      <Footer brand="divine_tables" lang={lang} />
    </div>
  );
}
