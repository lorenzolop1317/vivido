// Lectura de la lista de invitados que sube el organizador (Excel/CSV) para
// el envío masivo de invitaciones. Se usa desde el navegador (CreateAlbumForm
// es un componente cliente) — el archivo nunca se manda al servidor tal cual,
// se parsea acá y solo se envía la lista ya limpia (nombre + email).
//
// El import de 'xlsx' es dinámico a propósito: es una librería pesada y solo
// hace falta cuando alguien realmente sube un archivo, así que no infla el
// JS inicial de la página de creación de álbum para todo el mundo.

export interface GuestRow {
  name: string;
  email: string;
}

export interface ParsedGuestList {
  guests: GuestRow[];
  skipped: string[]; // filas descartadas, con el motivo — para mostrarle al organizador qué se salteó
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_KEY_RE = /^(nombre|name)$/i;
const EMAIL_KEY_RE = /^(e-?mail|correo)$/i;

/**
 * Lee un archivo .xlsx/.csv con columnas Nombre/Email (también acepta
 * "Name"/"Email" en inglés, en cualquier orden y con mayúsculas/minúsculas) y
 * devuelve la lista de invitados válida, más las filas que se descartaron
 * (sin email, con un email que no tiene forma de email, o repetido).
 */
export async function parseGuestListFile(data: ArrayBuffer): Promise<ParsedGuestList> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const guests: GuestRow[] = [];
  const skipped: string[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, index) => {
    const keys = Object.keys(row);
    const nameKey = keys.find((k) => NAME_KEY_RE.test(k.trim()));
    const emailKey = keys.find((k) => EMAIL_KEY_RE.test(k.trim()));
    const name = nameKey ? String(row[nameKey]).trim() : '';
    const email = (emailKey ? String(row[emailKey]).trim() : '').toLowerCase();
    const rowNumber = index + 2; // +2: la fila 1 del archivo es el encabezado

    if (!email) return; // fila vacía (ej. al final del archivo) — se ignora en silencio
    if (!EMAIL_RE.test(email)) {
      skipped.push(`Fila ${rowNumber}: "${email}" no parece un email válido.`);
      return;
    }
    if (seenEmails.has(email)) {
      skipped.push(`Fila ${rowNumber}: "${email}" está repetido, se le manda una sola vez.`);
      return;
    }
    seenEmails.add(email);
    guests.push({ name, email });
  });

  return { guests, skipped };
}
