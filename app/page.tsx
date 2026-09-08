import CreateAlbumForm from '@/components/CreateAlbumForm';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-dark">Álbum de Evento</h1>
        <p className="mt-2 text-sm text-gray-600">
          Un enlace, y todos los que estuvieron suben sus fotos y videos a un mismo álbum. Sin apps, sin
          login.
        </p>
      </div>
      <CreateAlbumForm />
    </main>
  );
}
