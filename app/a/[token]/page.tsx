import { notFound } from 'next/navigation';
import { getAlbumView } from '@/lib/albums';
import AlbumWorkspace from '@/components/AlbumWorkspace';

export default async function AlbumPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getAlbumView(token);

  if (!view) notFound();

  return <AlbumWorkspace token={token} initialView={view} />;
}
