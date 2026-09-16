// Límites del plan gratis, definidos en el documento de producto.
// Cambiarlos acá los cambia en toda la app — no hay números sueltos en el resto del código.

export const FREE_PLAN = {
  storageLimitBytes: 3 * 1024 * 1024 * 1024, // 3 GB por álbum
  videoMaxSeconds: 60, // clips de hasta 60 segundos
  uploadWindowDays: 14, // días desde la creación en los que se aceptan nuevos aportes
  retentionDays: 30, // días totales desde la creación hasta que el álbum se archiva
} as const;

export const PRO_PLAN = {
  // Placeholder para cuando se conecte Stripe y el plan pago.
  storageLimitBytes: 50 * 1024 * 1024 * 1024, // 50 GB
  videoMaxSeconds: null, // sin límite
  uploadWindowDays: null, // extensible
  retentionDays: null, // indefinida mientras la suscripción esté activa
} as const;

// Techos de las capas gratis de la infraestructura (no son un límite "por
// álbum" como los de arriba, sino del proyecto entero) — se usan solo para el
// visor de espacio del panel de super usuario (ver app/page.tsx y
// components/AdminDashboard.tsx). Son los números publicados por cada
// proveedor al momento de escribir esto; si sus planes gratis cambian, hay
// que actualizarlos acá.
export const INFRA_FREE_TIER = {
  r2StorageBytes: 10 * 1024 * 1024 * 1024, // Cloudflare R2: 10 GB de almacenamiento gratis/mes
} as const;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export function kindForContentType(contentType: string): 'photo' | 'video' | null {
  if (ACCEPTED_IMAGE_TYPES.includes(contentType)) return 'photo';
  if (ACCEPTED_VIDEO_TYPES.includes(contentType)) return 'video';
  return null;
}
