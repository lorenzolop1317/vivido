import CreateAlbumForm from '@/components/CreateAlbumForm';
import Footer from '@/components/Footer';
import BrandTheme from '@/components/BrandTheme';
import { BRANDS } from '@/lib/brands';

const config = BRANDS.divine_tables;

export const metadata = {
  title: config.name,
  description: config.tagline,
};

export default function DivineTablesHomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <BrandTheme brand="divine_tables" />
      <main className="mx-auto flex flex-1 w-full max-w-lg flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          {config.logoLockup ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoLockup} alt={config.name} className="mx-auto h-20 w-auto" />
          ) : (
            <h1 className="font-display text-4xl text-brand-dark">{config.name}</h1>
          )}
          <p className="mt-3 text-sm text-gray-600">{config.tagline}</p>
        </div>
        <CreateAlbumForm brand="divine_tables" />
      </main>
      <Footer brand="divine_tables" />
    </div>
  );
}
