// La librería "archiver" (v8) no publica tipos propios y @types/archiver todavía
// describe la API vieja (v5), que ya no aplica. Declaración mínima para poder
// tipar lo que usamos en lib/export.ts sin pelear con versiones desalineadas.
declare module 'archiver' {
  import type { Readable } from 'node:stream';

  export class ZipArchive extends Readable {
    constructor(options?: { zlib?: { level?: number } });
    append(source: Readable | Buffer | string, options: { name: string }): void;
    finalize(): Promise<void>;
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
  }
}
