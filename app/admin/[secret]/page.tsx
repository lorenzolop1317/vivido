import { notFound } from 'next/navigation';
import { isValidAdminSecret } from '@/lib/admin-auth';
import { listAllAlbums } from '@/lib/albums';
import AdminDashboard from '@/components/AdminDashboard';

export const metadata = {
  title: 'Panel — Vívido',
  robots: { index: false, follow: false },
};

export default async function AdminPage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  // Un secreto inválido se trata igual que una URL inexistente: no delatamos
  // que el panel de admin siquiera existe en ese path.
  if (!isValidAdminSecret(secret)) notFound();

  const albums = await listAllAlbums();

  return <AdminDashboard secret={secret} initialAlbums={albums} />;
}
