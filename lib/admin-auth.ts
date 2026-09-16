import { createHash, timingSafeEqual } from 'crypto';

/**
 * Autenticación del panel de super usuario (ahora vive en "/", ver
 * app/page.tsx). Sigue siendo un solo secreto en una variable de entorno
 * (ADMIN_SECRET) — no hay usuario/contraseña por persona ni base de datos de
 * cuentas — pero en vez de ir pegado en la URL como antes (/admin/<secreto>),
 * ahora se ingresa en un formulario de login normal y, si es correcto, se
 * guarda una cookie de sesión httpOnly para no tener que volver a escribirlo
 * en cada visita ni mandarlo en cada pedido desde el navegador.
 */
export const ADMIN_COOKIE_NAME = 'vivido_admin_session';
const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

/** Compara dos strings en tiempo constante (evita "timing attacks" triviales). */
function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Usado por el formulario de login: ¿la contraseña ingresada es la correcta? */
export function isValidAdminPassword(password: string | null | undefined): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || !password) return false;
  return safeEqual(password, expected);
}

/**
 * El valor que se guarda en la cookie de sesión no es la contraseña en texto
 * plano, sino un hash — así, aunque alguien lograra leer la cookie, no
 * recupera el secreto real.
 */
export function computeAdminSessionValue(): string | null {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return null;
  return sha256(expected);
}

/** Usado por las rutas protegidas: ¿la cookie de sesión que llegó es válida? */
export function isValidAdminSession(cookieValue: string | null | undefined): boolean {
  const expected = computeAdminSessionValue();
  if (!expected || !cookieValue) return false;
  return safeEqual(cookieValue, expected);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS,
};

// Compatibilidad: código/comentarios viejos referenciaban esta función con el
// nombre de la validación por URL (/admin/<secreto>), que ya no se usa —
// queda de alias por si algo la sigue importando.
export const isValidAdminSecret = isValidAdminPassword;
