import { getSupabaseAdmin } from './supabase';

/**
 * Guarda un mensaje del formulario de contacto del pie de página en Supabase
 * (tabla `contact_messages`). No hay todavía un servicio de envío de mails
 * conectado (Resend/SendGrid/etc.) — mientras tanto, esto es lo más simple
 * que funciona sin pedir credenciales nuevas: los mensajes se revisan desde
 * el Table Editor de Supabase. Se puede reemplazar más adelante por un envío
 * de email real sin tocar el formulario.
 */
export async function submitContactMessage(input: {
  name: string;
  email: string;
  message: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();

  if (!name || !email || !message) {
    return { ok: false, reason: 'Completá nombre, email y mensaje.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'El email no parece válido.' };
  }
  if (message.length > 4000) {
    return { ok: false, reason: 'El mensaje es demasiado largo.' };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('contact_messages').insert({ name, email, message });
  if (error) throw error;

  return { ok: true };
}
