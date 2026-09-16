/**
 * Autenticación del panel de super usuario. Sigue el mismo modelo de
 * "seguridad por capacidad" que ya usa el resto de la app (enlaces con token
 * en vez de usuario/contraseña): un único secreto largo en la variable de
 * entorno ADMIN_SECRET, que va en la URL (/admin/<secret>) en vez de en un
 * login. No hay sesiones ni cookies — cada acción vuelve a validar el secreto
 * server-side, así que no alcanza con adivinar la URL una vez para siempre.
 */
export function isValidAdminSecret(secret: string | null | undefined): boolean {
  const expected = process.env.ADMIN_SECRET;
  // Si no se configuró ADMIN_SECRET en el entorno, el panel queda inaccesible
  // por completo (nunca "abierto por error" por falta de configuración).
  if (!expected) return false;
  return !!secret && secret === expected;
}
