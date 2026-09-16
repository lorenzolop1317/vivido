import CreateAlbumForm from '@/components/CreateAlbumForm';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex flex-1 w-full max-w-lg flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl text-brand-dark">Vívido</h1>
          <p className="mt-2 text-sm text-gray-600">
            Un enlace, y todos los que estuvieron suben sus fotos y videos a un mismo álbum. Sin apps, sin
            login.
          </p>
        </div>
        <CreateAlbumForm brand="vivido" />
      </main>
      <Footer brand="vivido" />
    </div>
  );
}
