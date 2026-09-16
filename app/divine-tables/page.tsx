import type { Viewport } from 'next';
import DivineTablesHome from '@/components/DivineTablesHome';
import { BRANDS } from '@/lib/brands';

const config = BRANDS.divine_tables;

// manifest/icons/appleWebApp pisan lo que define app/layout.tsx (que trae los
// de Vívido) para que "agregar a inicio" desde acá use el logo y nombre de
// Divine Tables, no los de Vívido.
export const metadata = {
  title: config.name,
  description: config.tagline,
  manifest: '/brands/divine-tables/manifest.webmanifest',
  icons: {
    icon: '/brands/divine-tables/icon-192.png',
    apple: '/brands/divine-tables/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default' as const,
    title: config.name,
  },
};

// Mismo motivo que en app/a/[token]/page.tsx: sin esto, la barra de estado
// del celular queda con el naranja de Vívido (definido en app/layout.tsx)
// incluso en la página de creación de Divine Tables.
export const viewport: Viewport = {
  themeColor: config.colors.brand,
  width: 'device-width',
  initialScale: 1,
};

export default function DivineTablesPage() {
  return <DivineTablesHome />;
}
