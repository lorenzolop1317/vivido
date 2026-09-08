/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Las fotos se sirven desde URLs prefirmadas de Cloudflare R2 (dominio dinámico),
    // así que dejamos el optimizador de imágenes de Next.js sin restricción de dominios remotos.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
