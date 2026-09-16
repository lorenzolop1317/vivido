import { cache } from 'react';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getAlbumView } from '@/lib/albums';
import { BRANDS } from '@/lib/brands';
import AlbumWorkspace from '@/components/AlbumWorkspace';

// cache() evita pedirle dos veces lo mismo a Supabase: generateViewport,
// generateMetadata (abajo) y el componente de la página necesitan el mismo
// álbum, y así comparten una sola consulta dentro del mismo request.
const getCachedAlbumView = cache((token: string) => getAlbumView(token));

/**
 * El color de la barra de estado del celular (cuando la PWA está instalada o
 * en pantalla completa) sale de acá. app/layout.tsx define el naranja de
 * Vívido como valor por defecto para toda la app — esto lo pisa puntualmente
 * en la vista de un álbum cuando esa marca es Divine Tables, para que no se
 * vea el naranja de Vívido "colándose" en un álbum de otra marca.
 */
export async function generateViewport({ params }: { params: Promise<{ token: string }> }): Promise<Viewport> {
  const { token } = await params;
  const view = await getCachedAlbumView(token);
  const brand = view?.album.brand ?? 'vivido';
  return {
    themeColor: BRANDS[brand].colors.brand,
    width: 'device-width',
    initialScale: 1,
  };
}

/**
 * Igual razón que generateViewport de arriba, pero para "agregar a inicio":
 * si no se pisa nada acá, un álbum de Divine Tables hereda el manifest/ícono
 * de Vívido definidos en app/layout.tsx. Para Vívido devolvemos {} a propósito
 * (sin overrides) para que su comportamiento quede idéntico al de siempre.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const view = await getCachedAlbumView(token);
  const brand = view?.album.brand ?? 'vivido';
  if (brand !== 'divine_tables') return {};

  const config = BRANDS.divine_tables;
  return {
    title: view?.album.name ? `${view.album.name} — ${config.name}` : config.name,
    manifest: '/brands/divine-tables/manifest.webmanifest',
    icons: {
      icon: '/brands/divine-tables/icon-192.png',
      apple: '/brands/divine-tables/icon-192.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: config.name,
    },
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getCachedAlbumView(token);

  if (!view) notFound();

  return <AlbumWorkspace token={token} initialView={view} />;
}
