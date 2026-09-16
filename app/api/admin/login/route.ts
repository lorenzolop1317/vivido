import { NextRequest, NextResponse } from 'next/server';
import { isValidAdminPassword, computeAdminSessionValue, ADMIN_COOKIE_NAME, ADMIN_COOKIE_OPTIONS } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!isValidAdminPassword(password)) {
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  }

  const sessionValue = computeAdminSessionValue();
  if (!sessionValue) {
    // No debería pasar (isValidAdminPassword ya chequeó que ADMIN_SECRET existe),
    // pero por las dudas no dejamos pasar sin cookie.
    return NextResponse.json({ error: 'El panel no está configurado (falta ADMIN_SECRET).' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, sessionValue, ADMIN_COOKIE_OPTIONS);
  return response;
}
