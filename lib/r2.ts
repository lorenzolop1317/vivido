import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 habla el protocolo S3, así que usamos el SDK de AWS apuntado
 * al endpoint de la cuenta de Cloudflare. El bucket se mantiene PRIVADO
 * (no público) porque son fotos personales de terceros — todo acceso de
 * lectura/escritura pasa por URLs prefirmadas con expiración corta.
 */
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Faltan credenciales de R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). Ver .env.example.'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('Falta R2_BUCKET_NAME. Ver .env.example.');
  return bucket;
}

const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutos para completar la subida
const VIEW_URL_TTL_SECONDS = 60 * 60; // 1 hora para ver/descargar

export async function createUploadUrl(key: string, contentType: string) {
  const client = getR2Client();
  const command = new PutObjectCommand({ Bucket: getBucketName(), Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

export async function createViewUrl(key: string) {
  const client = getR2Client();
  const command = new GetObjectCommand({ Bucket: getBucketName(), Key: key });
  return getSignedUrl(client, command, { expiresIn: VIEW_URL_TTL_SECONDS });
}

/**
 * URL para MOSTRAR una foto/video (no para forzar descarga). Si el bucket tiene
 * configurada una "Public Development URL" (o dominio propio) en Cloudflare —
 * R2_PUBLIC_URL —, usamos esa: es siempre la MISMA url para el mismo archivo,
 * así el navegador (y el cache de Cloudflare) la puede reusar entre visitas en
 * vez de volver a descargarla cada vez. Las claves son UUIDs, no adivinables,
 * así que es el mismo modelo de "quien tiene el link, tiene acceso" que ya usa
 * el resto de la app (ver los tokens de álbum) — no queda listado ni indexado.
 * Si no está configurada esa variable, seguimos usando la URL firmada de
 * siempre (funciona igual, solo que no se puede cachear entre visitas).
 */
export async function getViewUrl(key: string) {
  const publicBase = process.env.R2_PUBLIC_URL;
  if (publicBase) {
    return `${publicBase.replace(/\/$/, '')}/${key}`;
  }
  return createViewUrl(key);
}

/**
 * Igual que createViewUrl, pero le pide a R2 que responda con
 * Content-Disposition: attachment. Así un <a href="..."> normal dispara una
 * descarga real (con el nombre de archivo elegido) en vez de abrir la imagen
 * en una pestaña nueva — funciona incluso siendo la URL de otro dominio,
 * porque el header lo pone el servidor, no el atributo `download` del link.
 */
export async function createDownloadUrl(key: string, filename: string) {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });
  return getSignedUrl(client, command, { expiresIn: VIEW_URL_TTL_SECONDS });
}

export async function deleteObject(key: string) {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
}

export function getR2ClientForStreaming() {
  // Uso interno para el export en zip (lib/export.ts), que necesita el objeto GetObjectCommand
  // directamente en vez de una URL firmada.
  return { client: getR2Client(), bucket: getBucketName() };
}
