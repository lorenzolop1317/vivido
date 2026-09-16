'use client';

import { useEffect } from 'react';
import { BRANDS, type BrandKey } from '@/lib/brands';

/**
 * Pisa las variables CSS de marca (colores + tipografía de título) en el
 * elemento <html> para lo que dure esta página. app/globals.css define los
 * valores por defecto de Vívido en @theme/:root; acá los sobreescribimos en
 * el navegador cuando corresponde (ej. un álbum de Divine Tables), sin tocar
 * nada del CSS de Vívido. Al desmontar (se navega a otra página) restauramos
 * los valores de Vívido, para que una marca nunca "se filtre" a la otra.
 */
export default function BrandTheme({ brand }: { brand: BrandKey }) {
  useEffect(() => {
    const root = document.documentElement;
    const config = BRANDS[brand];

    root.style.setProperty('--color-brand', config.colors.brand);
    root.style.setProperty('--color-brand-dark', config.colors.brandDark);
    root.style.setProperty('--color-paper', config.colors.paper);
    root.style.setProperty('--color-ink', config.colors.ink);
    root.style.setProperty('--font-display', config.fontDisplay);

    return () => {
      const def = BRANDS.vivido;
      root.style.setProperty('--color-brand', def.colors.brand);
      root.style.setProperty('--color-brand-dark', def.colors.brandDark);
      root.style.setProperty('--color-paper', def.colors.paper);
      root.style.setProperty('--color-ink', def.colors.ink);
      root.style.setProperty('--font-display', def.fontDisplay);
    };
  }, [brand]);

  return null;
}
