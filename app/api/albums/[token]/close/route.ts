import { NextRequest, NextResponse } from 'next/server';
import { closeAlbum } from '@/lib/albums';

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await closeAlbum(token);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
