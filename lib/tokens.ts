import { customAlphabet } from 'nanoid';

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) por si alguna vez se transcribe a mano.
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const generate = customAlphabet(alphabet, 24);

/**
 * Genera un token de acceso "capability-style": quien lo tiene, tiene el rol asociado.
 * No hay login de invitados — la seguridad del álbum depende de que estos enlaces
 * no se hagan públicos ni indexables (por eso nunca deben listarse en páginas públicas).
 */
export function generateAccessToken(): string {
  return generate();
}
