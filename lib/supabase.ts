import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para uso EXCLUSIVO del servidor (API routes y Server Components).
 *
 * Usa la Service Role Key a propósito: los invitados no tienen cuenta ni sesión,
 * así que el control de acceso no lo hace Supabase Auth / RLS por usuario, sino
 * la lógica de esta app en base al token de la URL (ver lib/albums.ts).
 *
 * Por eso esta clave NUNCA debe exponerse al navegador ni usarse en un componente
 * cliente ("use client"). Si en el futuro se agrega login real para organizadores,
 * conviene sumar un segundo cliente con la clave anónima + RLS para ese flujo.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Revisá el archivo .env.local (ver .env.example).'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
