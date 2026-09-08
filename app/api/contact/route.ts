import { NextRequest, NextResponse } from 'next/server';
import { submitContactMessage } from '@/lib/contact';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const result = await submitContactMessage({ name: body.name, email: body.email, message: body.message });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
