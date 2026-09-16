import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, getContributorToken } from '@/lib/albums';
import { sendEmail, isEmailSendingConfigured } from '@/lib/mailer';
import { renderInviteEmailHtml } from '@/lib/emailTemplates';
import { BRANDS } from '@/lib/brands';

// Envíos grandes (varios cientos de invitados, uno por uno con una pequeña
// pausa entre cada uno) pueden tardar más que el timeout por defecto de una
// función serverless — mismo motivo que app/api/albums/[token]/export/route.ts.
export const maxDuration = 300;

const MAX_GUESTS_PER_SEND = 500;
const DELAY_BETWEEN_EMAILS_MS = 550; // debajo del límite de la capa gratis de Resend (2 req/s)

interface GuestInput {
  name: string;
  email: string;
}

/** Envía la invitación (branding + QR + enlace) a cada invitado de la lista que subió el organizador. */
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const resolved = await resolveToken(token);
  if (!resolved || (resolved.role !== 'organizer' && resolved.role !== 'moderator')) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  if (!isEmailSendingConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const guests: GuestInput[] = Array.isArray(body?.guests)
    ? body.guests.filter((g: unknown): g is GuestInput => Boolean(g && typeof g === 'object' && typeof (g as GuestInput).email === 'string'))
    : [];
  const subject: string = typeof body?.subject === 'string' && body.subject.trim() ? body.subject.trim() : `¡Estás invitado! — ${resolved.album.name}`;
  const senderName: string = typeof body?.senderName === 'string' && body.senderName.trim() ? body.senderName.trim() : BRANDS[resolved.album.brand].name;
  const bodyText: string = typeof body?.bodyText === 'string' ? body.bodyText : '';

  if (guests.length === 0) {
    return NextResponse.json({ error: 'No hay invitados para enviar.' }, { status: 400 });
  }
  if (guests.length > MAX_GUESTS_PER_SEND) {
    return NextResponse.json({ error: `Máximo ${MAX_GUESTS_PER_SEND} invitados por envío.` }, { status: 400 });
  }

  const contributorToken = await getContributorToken(resolved.album.id);
  if (!contributorToken) {
    return NextResponse.json({ error: 'No se encontró el enlace de invitados de este álbum.' }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const link = `${origin}/a/${contributorToken}`;
  const brand = BRANDS[resolved.album.brand];

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const guest of guests) {
    const html = await renderInviteEmailHtml({
      brand,
      albumName: resolved.album.name,
      eventDate: resolved.album.event_date,
      location: resolved.album.location,
      guestName: guest.name ?? '',
      bodyText,
      link,
      origin,
    });
    const result = await sendEmail({
      to: guest.email,
      subject,
      html,
      fromName: senderName,
      replyTo: brand.contactEmail,
    });
    results.push({ email: guest.email, ok: result.ok, error: result.ok ? undefined : result.error });
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS));
  }

  return NextResponse.json({ results });
}
