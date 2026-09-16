import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, isValidAdminSession } from '@/lib/admin-auth';
import { listAllAlbums } from '@/lib/albums';
import AdminDashboard from '@/components/AdminDashboard';
import AdminLogin from '@/components/AdminLogin';

export const metadata = {
  title: 'Panel — Vívido',
  robots: { index: false, follow: false },
};

/**
 * "/" solía ser la página de creación de álbumes de Vívido — eso se mudó a
 * /vivido (ver app/vivido/page.tsx) para que la base del sitio sea el panel
 * de super usuario, protegido por login (ver lib/admin-auth.ts). Así, alguien
 * que "recorte" la URL de un álbum hasta la raíz no se encuentra con un
 * formulario de creación abierto para cualquiera, sino con una pantalla de
 * login.
 */
export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminSession(session)) {
    return <AdminLogin />;
  }

  const albums = await listAllAlbums();
  return <AdminDashboard initialAlbums={albums} />;
}
