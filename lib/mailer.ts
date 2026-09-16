// Envío de emails para las invitaciones masivas. Server-only: nunca se
// importa desde un componente cliente porque usa credenciales.
//
// Soporta dos proveedores, elegidos automáticamente según qué variables de
// entorno estén cargadas (ver .env.example y el README, sección "Envío de
// invitaciones por email"):
//
// - Gmail (recomendado para esta fase beta): usa una cuenta de Gmail común
//   con una "contraseña de aplicación", sin necesidad de tener un dominio
//   propio. Tope de ~500 emails/día por cuenta.
// - Resend: pensado para cuando haya un dominio propio verificado — mejor
//   entregabilidad y un tope más alto. Se usa en cambio de Gmail si sus
//   variables están cargadas.
//
// Mientras no esté cargado ninguno de los dos, isEmailSendingConfigured()
// da false y la app avisa en vez de intentar mandar algo que va a fallar.

import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';

type Provider = 'resend' | 'gmail' | null;

function activeProvider(): Provider {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) return 'resend';
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  return null;
}

export function isEmailSendingConfigured(): boolean {
  return activeProvider() !== null;
}

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY as string);
  return resendClient;
}

let gmailTransport: Transporter | null = null;
function getGmailTransport(): Transporter {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return gmailTransport;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const provider = activeProvider();

  if (provider === 'resend') {
    try {
      const { error } = await getResendClient().emails.send({
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

  if (provider === 'gmail') {
    try {
      await getGmailTransport().sendMail({
        from: `${opts.fromName} <${process.env.GMAIL_USER}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo: opts.replyTo,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido.' };
    }
  }

  return { ok: false, error: 'not_configured' };
}
