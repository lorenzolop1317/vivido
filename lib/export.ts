import { ZipArchive } from 'archiver';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { getR2ClientForStreaming } from './r2';
import { getSupabaseAdmin } from './supabase';

/**
 * Arma un .zip con todo el contenido del álbum, trayendo cada archivo de R2 y
 * empaquetándolo al vuelo (streaming), sin bajarlo entero a disco primero.
 *
 * Limitación conocida del MVP: esto corre dentro de una función serverless de
 * Vercel, que tiene un límite de tiempo de ejecución. Para los álbumes de prueba
 * (tope de 3 GB) debería andar bien, pero si más adelante el plan pago permite
 * álbumes de 50 GB conviene pasar esto a un job en segundo plano que arme el
 * zip y avise por email cuando esté listo, en vez de generarlo en el momento.
 */
export function streamAlbumZip(albumId: string): NodeJS.ReadableStream {
  const archive = new ZipArchive({ zlib: { level: 6 } });

  (async () => {
    try {
      const supabase = getSupabaseAdmin();
      const { data: mediaRows, error } = await supabase
        .from('media')
        .select('r2_key, content_type, created_at')
        .eq('album_id', albumId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const { client, bucket } = getR2ClientForStreaming();

      let index = 1;
      for (const row of mediaRows ?? []) {
        const extension = row.content_type.split('/')[1] ?? 'bin';
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: row.r2_key }));
        const body = response.Body as Readable;
        const filename = `${String(index).padStart(3, '0')}.${extension}`;
        archive.append(body, { name: filename });
        index += 1;
      }

      await archive.finalize();
    } catch (err) {
      archive.emit('error', err as Error);
    }
  })();

  return archive;
}
