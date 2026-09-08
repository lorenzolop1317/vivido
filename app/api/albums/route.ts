import { NextRequest, NextResponse } from 'next/server';
import { createAlbum } from '@/lib/albums';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'El álbum necesita un nombre.' }, { status: 400 });
  }

  const result = await createAlbum({
    name,
    eventDate: typeof body?.eventDate === 'string' ? body.eventDate : null,
    location: typeof body?.location === 'string' ? body.location : null,
  });

  return NextResponse.json(result, { status: 201 });
}
