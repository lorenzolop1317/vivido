// Configuración de las "marcas" bajo las que puede crearse un álbum. Vívido
// es la marca propia de la app y queda tal cual estaba. Divine Tables es la
// marca de la prima (eventos de picnic) — un entorno paralelo con su propia
// paleta, tipografía y logo, sin tocar nada de Vívido.
//
// Cómo se aplica en la práctica:
// - Los colores viven como variables CSS (--color-brand, --color-brand-dark,
//   --color-paper, --color-ink, --font-display), definidas por defecto para
//   Vívido en app/globals.css. <BrandTheme> (components/BrandTheme.tsx) las
//   sobreescribe en el navegador cuando el álbum es de otra marca.
// - Cada página "de entrada" (creación de álbum) y la vista de álbum usan
//   BRANDS[brand] para mostrar el logo, nombre y footer correctos.

export type BrandKey = 'vivido' | 'divine_tables';

export interface BrandConfig {
  key: BrandKey;
  name: string;
  tagline: string;
  colors: {
    brand: string;
    brandDark: string;
    paper: string;
    ink: string;
  };
  fontDisplay: string; // usado por --font-display (título de marca y de álbum)
  wordmarkItalic: boolean;
  logoLockup: string | null; // logo completo (marca + texto), para el footer
  logoMark: string | null; // solo el isotipo, para espacios chicos
  contactEmail: string;
  instagram?: string;
  createPath: string; // dónde se crea un álbum de esta marca
}

export const BRANDS: Record<BrandKey, BrandConfig> = {
  vivido: {
    key: 'vivido',
    name: 'Vívido',
    tagline: 'Un enlace, y todos los que estuvieron suben sus fotos y videos a un mismo álbum. Sin apps, sin login.',
    colors: {
      brand: '#d6491f',
      brandDark: '#5b2a54',
      paper: '#f6efe4',
      ink: '#2a2019',
    },
    fontDisplay: "'Instrument Serif', Georgia, serif",
    wordmarkItalic: true,
    logoLockup: null, // Vívido usa el wordmark tipográfico (.font-display), no una imagen
    logoMark: null,
    contactEmail: 'hola@vivido.app',
    instagram: 'vivido.app',
    createPath: '/',
  },
  divine_tables: {
    key: 'divine_tables',
    name: 'Divine Tables',
    tagline: 'It’s not just a table.. it’s a moment. Compartí las fotos de tu evento en un solo álbum, sin apps ni login.',
    colors: {
      brand: '#3f6b45',
      brandDark: '#1f3b26',
      paper: '#f4eade',
      ink: '#22301f',
    },
    fontDisplay: "'Playfair Display', Georgia, serif",
    wordmarkItalic: false,
    logoLockup: '/brands/divine-tables/logo-lockup.png',
    logoMark: '/brands/divine-tables/logo-mark.png',
    contactEmail: 'divinetablesnyc@gmail.com',
    instagram: 'divinetablesnyc',
    createPath: '/divine-tables',
  },
};

export function getBrand(key: string | null | undefined): BrandConfig {
  if (key === 'divine_tables') return BRANDS.divine_tables;
  return BRANDS.vivido;
}
