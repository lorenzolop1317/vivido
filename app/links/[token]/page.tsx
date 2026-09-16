import { notFound } from 'next/navigation';
import { resolveToken, getAllRoleTokens } from '@/lib/albums';
import { BRANDS } from '@/lib/brands';
import { LANDING_STRINGS } from '@/lib/i18n';
import BrandTheme from '@/components/BrandTheme';
import AlbumLinksView from '@/components/AlbumLinksView';

export const metadata = {
  title: 'Enlaces del álbum',
  robots: { index: false, follow: false },
};

/**
 * Página para recuperar los enlaces de un álbum si el organizador los pierde
 * (o el super usuario necesita volver a compartirlos/generar el QR). Solo
 * funciona con el enlace de organizador — es el único de los tres tokens que
 * ya se consideraba "de gestión" y el que ya se copia desde el panel de admin
 * (botón "Enlaces Web" en AdminDashboard). Si el token no es de organizador,
 * o el álbum ya no existe, esto da 404 en vez de exponer nada.
 */
export default async function AlbumLinksPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  if (!resolved || resolved.role !== 'organizer') notFound();

  const tokens = await getAllRoleTokens(resolved.album.id);
  if (!tokens) notFound();

  const brand = resolved.album.brand;
  const config = BRANDS[brand];
  const lang = 'es' as const;
  const t = LANDING_STRINGS[lang];

  const links = {
    organizer: `/a/${tokens.organizer}`,
    contributor: `/a/${tokens.contributor}`,
    viewer: `/a/${tokens.viewer}`,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <BrandTheme brand={brand} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-12">
        <div className="mb-8 text-center">
          {config.logoLockup ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoLockup} alt={config.name} className="mx-auto h-16 w-auto sm:h-20" />
          ) : (
            <h1 className="font-display text-3xl text-brand-dark">{config.name}</h1>
          )}
          <p className="mt-4 text-lg font-semibold text-brand-dark">{t.linksPageTitle}</p>
          <p className="mt-2 text-sm text-gray-500">
            {t.linksPageHint.replace('{{albumName}}', resolved.album.name)}
          </p>
        </div>
        <AlbumLinksView albumName={resolved.album.name} brand={brand} lang={lang} links={links} />
      </main>
    </div>
  );
}
