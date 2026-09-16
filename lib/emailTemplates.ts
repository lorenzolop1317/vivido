// HTML del email de invitación (envío masivo a la lista de invitados). Estilos
// todos inline a propósito — es lo único que anda de forma confiable en la
// mayoría de los clientes de correo (Gmail, Outlook, Apple Mail no siempre
// respetan un <style> en el <head>).

import QRCode from 'qrcode';
import type { BrandConfig } from './brands';

export interface InviteEmailInput {
  brand: BrandConfig;
  albumName: string;
  eventDate: string | null;
  location: string | null;
  guestName: string;
  bodyText: string;
  link: string;
  origin: string; // para armar la URL absoluta del logo — un email no tiene "página actual" desde donde resolver una ruta relativa
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Reemplaza {{nombre}} en el texto configurado por el organizador, con un saludo genérico si el invitado no tiene nombre cargado. */
function applyGuestName(bodyText: string, guestName: string) {
  const name = guestName.trim();
  return bodyText.replace(/\{\{\s*nombre\s*\}\}/gi, name || '');
}

export async function renderInviteEmailHtml(input: InviteEmailInput): Promise<string> {
  const { brand, albumName, eventDate, location, guestName, bodyText, link, origin } = input;
  const greeting = guestName.trim() ? `¡Hola, ${escapeHtml(guestName.trim())}!` : '¡Hola!';
  const personalizedBody = applyGuestName(bodyText, guestName)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p style="margin:0 0 14px 0;">${escapeHtml(line)}</p>`)
    .join('');

  const meta = [eventDate, location].filter(Boolean).join(' · ');

  let qrImg = '';
  try {
    const qrDataUrl = await QRCode.toDataURL(link, { width: 320, margin: 1 });
    qrImg = `
      <tr>
        <td align="center" style="padding: 8px 0 4px 0;">
          <img src="${qrDataUrl}" width="160" height="160" alt="Código QR" style="display:block;border:0;" />
          <p style="margin:8px 0 0 0;font-size:12px;color:#8a8a8a;">o escaneá este código con la cámara del celular</p>
        </td>
      </tr>`;
  } catch {
    // Si por lo que sea falla la generación del QR, el email igual sirve —
    // el botón de abajo es el link directo y es lo que realmente importa.
    qrImg = '';
  }

  const logoBlock = brand.logoLockup
    ? `<img src="${origin}${brand.logoLockup}" alt="${escapeHtml(brand.name)}" height="48" style="display:block;border:0;" />`
    : `<span style="font-size:26px;font-weight:600;color:${brand.colors.brandDark};">${escapeHtml(brand.name)}</span>`;

  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:${brand.colors.paper};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${brand.colors.paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:${brand.colors.paper};padding:24px;text-align:center;border-bottom:4px solid ${brand.colors.brand};">
                ${logoBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px 28px;">
                <p style="margin:0 0 4px 0;font-size:20px;font-weight:600;color:${brand.colors.ink};">${greeting}</p>
                <h1 style="margin:0 0 4px 0;font-size:22px;color:${brand.colors.brandDark};">${escapeHtml(albumName)}</h1>
                ${meta ? `<p style="margin:0 0 16px 0;font-size:13px;color:#8a8a8a;">${escapeHtml(meta)}</p>` : ''}
                <div style="font-size:15px;line-height:1.5;color:${brand.colors.ink};">
                  ${personalizedBody || '<p style="margin:0 0 14px 0;">Te invitamos a compartir tus fotos y videos de este evento.</p>'}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 28px 8px 28px;">
                <a href="${link}" style="display:inline-block;background-color:${brand.colors.brand};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px;">
                  Subir fotos y videos
                </a>
              </td>
            </tr>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${qrImg}</table>
            <tr>
              <td style="padding:20px 28px 28px 28px;">
                <p style="margin:0;font-size:12px;color:#b5b5b5;word-break:break-all;">${escapeHtml(link)}</p>
                <p style="margin:16px 0 0 0;font-size:12px;color:#b5b5b5;">${escapeHtml(brand.name)} · ${escapeHtml(brand.contactEmail)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
