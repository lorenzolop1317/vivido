# Álbum de Evento — MVP

Nombre de trabajo temporal (falta el branding real). Código fuente del MVP descripto en el
documento de producto: álbum colaborativo post-evento, sin login para los invitados, PWA
instalable, plan gratis con límites (3 GB por álbum, video hasta 60s, 14 días de ventana de
subida, 30 días de retención total).

## Cómo está armado

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4** — un solo proyecto, frontend y
  backend (API routes) juntos.
- **Supabase (Postgres)** — guarda álbumes, roles/enlaces y metadata de cada foto/video.
- **Cloudflare R2** — donde viven los archivos en sí (fotos y videos). El bucket es privado;
  la app genera URLs firmadas de corta duración tanto para subir como para ver/descargar.
- **Sin login de invitados** — cada rol (organizador, moderador, contribuyente, espectador)
  es un enlace único e impredecible (`/a/<token>`). Quien tiene el enlace, tiene ese permiso.
  Por eso el enlace de organizador nunca se comparte públicamente.

```
app/                    páginas y API routes
  page.tsx              crear álbum
  a/[token]/page.tsx     vista del álbum (se adapta según el rol del enlace)
  api/                   endpoints usados por los componentes cliente
components/
  CreateAlbumForm.tsx    formulario de creación (cliente)
  AlbumWorkspace.tsx     subida, galería y moderación (cliente)
lib/
  albums.ts              toda la lógica de negocio (roles, límites, ventanas)
  r2.ts                  integración con Cloudflare R2
  supabase.ts            cliente de Supabase (server-only)
  export.ts               armado del .zip para descarga
  cleanup.ts              archivado de álbumes vencidos (retención)
  limits.ts               los números del plan gratis, en un solo lugar
supabase/schema.sql       esquema de base de datos, para pegar en Supabase
```

## Puesta en marcha (una vez, antes de programar o desplegar)

### 1. Supabase
1. Crear cuenta/proyecto en [supabase.com](https://supabase.com) (capa gratis alcanza para
   este MVP).
2. En el proyecto, ir a **SQL Editor**, pegar el contenido de `supabase/schema.sql` y
   ejecutarlo. Esto crea las tres tablas (`albums`, `album_tokens`, `media`).
3. En **Project Settings → API**, copiar:
   - `Project URL` → variable `SUPABASE_URL`
   - `service_role` key (no la `anon`) → variable `SUPABASE_SERVICE_ROLE_KEY`

### 2. Cloudflare R2
1. Crear cuenta en [Cloudflare](https://dash.cloudflare.com) si no existe una, e ir a **R2**.
2. Crear un bucket (ej. `event-album-media`). Dejarlo **privado** (no público) — es
   importante, porque son fotos personales de terceros.
3. En **R2 → Manage API Tokens**, crear un token con permisos de lectura/escritura sobre
   ese bucket. Copiar:
   - `Account ID` → `R2_ACCOUNT_ID`
   - `Access Key ID` → `R2_ACCESS_KEY_ID`
   - `Secret Access Key` → `R2_SECRET_ACCESS_KEY`
   - Nombre del bucket → `R2_BUCKET_NAME`

### 3. Variables de entorno
Copiar `.env.example` a `.env.local` y completar los valores de los dos pasos anteriores,
más un `CRON_SECRET` inventado (cualquier texto largo al azar).

### 4. Correrlo en local
```bash
npm install
npm run dev
```
Abrir `http://localhost:3000`, crear un álbum de prueba y probar el flujo completo
(subir una foto, verla en la galería, borrarla, cerrar el álbum, descargar el zip).

### 5. Desplegar en Vercel
1. Subir este código a un repositorio de GitHub propio (`git init`, `git add`, `git commit`,
   crear el repo en GitHub y hacer push).
2. En [vercel.com](https://vercel.com), **Add New → Project**, importar ese repositorio.
3. En **Environment Variables**, cargar las mismas variables de `.env.local`.
4. Deploy. Vercel va a asignar un subdominio gratuito (`tu-proyecto.vercel.app`) — tal como
   se decidió, no hace falta dominio propio todavía.
5. El cron de limpieza (`vercel.json`) se activa solo al desplegar; Vercel agrega
   automáticamente el header `Authorization: Bearer $CRON_SECRET` en cada disparo diario,
   así que no hay nada más que configurar ahí.

## Limitaciones conocidas de este MVP (a propósito, para no sobre-construir antes de validar)

- **"Borrar solo lo mío" en el enlace de invitados**: como todos los invitados comparten un
  mismo enlace de contribuyente, la app distingue "lo tuyo" con un id anónimo guardado en el
  navegador de cada uno (ver `DEVICE_ID_KEY` en `AlbumWorkspace.tsx`). Es un acuerdo de buena
  fe razonable para un álbum de amigos/familia, no una medida de seguridad fuerte — alguien
  con conocimientos técnicos podría evitarla. Si se necesita algo más estricto, el siguiente
  paso sería pedir un nombre al entrar y/o generar un enlace individual por invitado.
- **Duración de video**: se valida en el navegador antes de subir (60s en el plan gratis). No
  hay una segunda verificación server-side del archivo real todavía — se puede sumar más
  adelante con `ffprobe` si hiciera falta blindarlo.
- **Descarga en .zip**: se arma al vuelo en una función serverless de Vercel. Para álbumes
  del tope actual (3 GB) debería andar bien, pero tiene un límite de tiempo de ejecución
  (`maxDuration` en `app/api/albums/[token]/export/route.ts`, hoy en 300s). Si el plan pago
  permite álbumes mucho más grandes, conviene pasar esto a un proceso en segundo plano que
  arme el zip y avise por email cuando esté listo.
- **PWA**: instalable ("agregar a inicio") desde el día uno. Todavía no tiene cola de subida
  offline (guardar la foto si se corta la conexión y reintentar sola) — quedó anotado como
  mejora de fase 2, no bloquea el uso normal con buena señal.
- **Íconos**: `public/icons/icon-192.png` y `icon-512.png` son placeholders genéricos —
  reemplazar por los reales apenas haya branding definido.
- **Plan pago**: el esquema y el código ya distinguen `plan: 'free' | 'pro'` y dejan lugar
  para el rol de co-moderador, pero todavía no hay integración de Stripe ni pantalla de
  upgrade — se agrega cuando se decida activar la monetización.

## Costos mientras se prueba

Con 3-4 álbumes de prueba a full, todo entra dentro de las capas gratuitas de Supabase,
Cloudflare R2 y Vercel (ver el documento de producto para el detalle de por qué y cuándo
eso deja de ser así).
