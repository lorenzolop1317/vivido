// Envío de emails vía Resend (resend.com). Server-only: nunca se importa
// desde un componente cliente porque usa la API key.
//
// Para que esto funcione en producción hacen falta dos variables de entorno
// (ver .env.example y el README): RESEND_API_KEY y RESEND_FROM_EMAIL (una
// dirección de un dominio verificado en tu cuenta de Resend). Mientras no
// estén cargadas, isEmailSendingConfigured() da false y la app avisa en vez
// de intentar mandar algo que va a fallar.

import { Resend } from 'resend';

export function isEmailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

let cachedClient: Resend | null = null;
function getClient(): Resend {
  if (!cachedClient) cachedClient = new Resend(process.env.RESEND_API_KEY as string);
  return cachedClient;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailSendingConfigured()) return { ok: false, error: 'not_configured' };

  try {
    const { error } = await getClient().emails.send({
      from: `${opts.fromName} <${process.env.RESEND_FROM_EMAIL}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido.' };
  }
}
