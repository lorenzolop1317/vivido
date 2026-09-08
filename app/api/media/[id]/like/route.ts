import { NextRequest, NextResponse } from 'next/server';
import { toggleLike } from '@/lib/albums';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : '';

  const result = await toggleLike(id, deviceId);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? 'No se pudo procesar el like.' }, { status: 400 });
  }

  return NextResponse.json({ liked: result.liked, likeCount: result.likeCount });
}
