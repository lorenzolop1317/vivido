# Vívido — MVP

Código fuente del MVP descripto en el documento de producto: álbum colaborativo post-evento,
sin login para los invitados, PWA instalable, plan gratis con límites (3 GB por álbum, video
hasta 60s, 14 días de ventana de subida). La retención de 30 días existe en el esquema pero,
mientras estamos en fase beta con un solo super usuario, queda **apagada por defecto** álbum
por álbum — ver "Fase beta: retención y panel de admin" más abajo.

Marca ya aplicada (ver el brand board del proyecto para el set completo): mark "esquinero en V"
(`public/icons/`), paleta Flash/Negativo/Papel/Tinta (`app/globals.css`) y tipografía
Instrument Serif + Caveat + Plus Jakarta Sans (`app/layout.tsx`).

Además de Vívido, la app sirve un segundo "entorno paralelo" de marca blanca para el negocio
de eventos de una prima, **Divine Tables** (`/divine-tables`) — ver "Multi-marca" más abajo.

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
  page.tsx              crear álbum (Vívido)
  divine-tables/page.tsx crear álbum (Divine Tables — mismo flujo, otra marca)
  admin/[secret]/page.tsx panel de super usuario (protegido por ADMIN_SECRET)
  a/[token]/page.tsx     vista del álbum (se adapta según el rol del enlace y la marca)
  api/                   endpoints usados por los componentes cliente
  api/admin/             endpoints del panel de admin (retención por álbum, borrado completo)
components/
  CreateAlbumForm.tsx    formulario de creación (cliente), acepta la marca como prop
  AlbumWorkspace.tsx     subida, galería, portada y moderación (cliente)
  AdminDashboard.tsx     lista de álbumes, toggle de retención y borrado completo (cliente)
  BrandTheme.tsx         pisa los colores/tipografía de marca en el navegador según el álbum
  Footer.tsx             pie de página (contacto, copyright, logo) — en todas las páginas
lib/
  albums.ts              toda la lógica de negocio (roles, límites, ventanas, portada, admin)
  brands.ts              configuración de cada marca (colores, logo, contacto) — Vívido/Divine Tables
  admin-auth.ts          valida el secreto del panel de super usuario
  contact.ts              guarda los mensajes del formulario de contacto
  r2.ts                  integración con Cloudflare R2
  supabase.ts            cliente de Supabase (server-only)
  export.ts               armado del .zip para descarga (siempre con el archivo original)
  cleanup.ts              archivado de álbumes vencidos (retención, solo si está activada)
  limits.ts               los números del plan gratis, en un solo lugar
supabase/schema.sql       esquema de base de datos, para pegar en Supabase
```

## Puesta en marcha (una vez, antes de programar o desplegar)

### 1. Supabase
1. Crear cuenta/proyecto en [supabase.com](https://supabase.com) (capa gratis alcanza para
   este MVP).
2. En el proyecto, ir a **SQL Editor**, pegar el contenido de `supabase/schema.sql` y
   ejecutarlo. Esto crea las tablas (`albums`, `album_tokens`, `media`, `media_likes`,
   `contact_messages`). Si el proyecto ya existía de antes, correr el mismo archivo de
   nuevo no rompe nada — los `alter table ... add column if not exists` solo agregan lo
   que falte (portada de álbum, copia liviana de fotos, etc.).
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
más un `CRON_SECRET` y un `ADMIN_SECRET` inventados (dos textos largos y distintos, al azar —
por ejemplo con `openssl rand -hex 24`).

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

## Fase beta: retención y panel de admin

Mientras el único usuario real sos vos (Lorenzo) probando álbumes de prueba (cumple, boda,
etc.), el auto-borrado por antigüedad viene **apagado por defecto** para todo álbum nuevo
(columna `retention_enabled` en `albums`, `false` por default). Eso significa que ningún álbum
se archiva ni se borra solo, sin importar cuántos días pasen — hasta que vos lo prendas a mano.

El panel de super usuario vive en `https://tu-dominio/admin/<ADMIN_SECRET>` (el mismo modelo de
"seguridad por enlace" que ya usa el resto de la app, no hay usuario/contraseña). Desde ahí podés:
- Ver todos los álbumes (de las dos marcas), cuánto espacio ocupa cada uno y cuándo se creó.
- Prender o apagar el auto-borrado álbum por álbum (el interruptor "Auto-borrado por
  antigüedad").
- Borrar un álbum por completo (fotos/videos en Cloudflare R2 + el álbum en la base) para
  liberar espacio — pide escribir "BORRAR" para confirmar porque no se puede deshacer.
- Copiar el enlace de organizador de cualquier álbum, por si lo perdiste.

Cuando algún álbum sea "real" (por ejemplo, uno de una clienta de Divine Tables) y quieras que
se archive solo a los N días como cualquier álbum del plan gratis, entrás al panel y prendés
el interruptor para ese álbum puntual.

## Multi-marca (Vívido / Divine Tables)

La app sirve dos "entornos" con la misma base de código, sin tocar nada de Vívido:
- **Vívido** (`/`): queda exactamente como estaba.
- **Divine Tables** (`/divine-tables`): página de creación con el logo, colores (verde oscuro
  `#1f3b26` / crema `#f4eade`) y tipografía de esa marca, pensada para que tu prima la use en
  sus eventos sin que aparezca "Vívido" en ningún lado.

Toda la configuración de marca (nombre, colores, logo, tipografía, email de contacto,
Instagram) vive en un solo lugar: `lib/brands.ts`. Cada álbum guarda con qué marca se creó
(columna `brand` en `albums`), y `components/BrandTheme.tsx` aplica los colores/tipografía
correctos en el navegador cuando alguien entra a un álbum de Divine Tables — sin duplicar
ninguna clase de Tailwind ni tocar el diseño de Vívido. El panel de admin (arriba) deja
filtrar y gestionar los álbumes de ambas marcas desde un mismo lugar.

Fuera de alcance por ahora (no bloquea el uso, es una limitación conocida): el manifest de la
PWA y el ícono de "agregar a inicio" siguen siendo siempre los de Vívido — Next.js no permite
un manifest distinto según la URL sin una reestructuración más grande. Si Divine Tables
necesita instalarse como app propia más adelante, es la siguiente mejora natural acá.

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
- **Íconos**: `public/icons/icon-192.png` y `icon-512.png` ya son la marca real (el esquinero
  en V sobre plum). Si el mark se retoca más adelante, regenerarlos desde el mismo SVG del
  brand board para que quede pixel-perfect.
- **Plan pago**: el esquema y el código ya distinguen `plan: 'free' | 'pro'` y dejan lugar
  para el rol de co-moderador, pero todavía no hay integración de Stripe ni pantalla de
  upgrade — se agrega cuando se decida activar la monetización.
- **Fotos en dos versiones**: cada foto se sube en su calidad original (para descargar) y,
  si es grande, además se genera en el propio navegador una copia liviana (~1920px, JPEG)
  solo para mostrar en la galería web — así carga mucho más rápido sin resignar calidad al
  bajarla. Esto usa algo más de almacenamiento (las dos copias cuentan contra el límite del
  plan). Los videos por ahora no tienen esta copia liviana (ver `BACKLOG.md`).
- **Formulario de contacto**: los mensajes se guardan en la tabla `contact_messages` de
  Supabase (con la marca de origen) — no hay todavía un email de notificación real conectado
  (se revisan desde el Table Editor). El email y el Instagram que se muestran en el pie de
  página salen de `lib/brands.ts` — cambiarlos ahí si hace falta actualizarlos.

## Costos mientras se prueba

Con 3-4 álbumes de prueba a full, todo entra dentro de las capas gratuitas de Supabase,
Cloudflare R2 y Vercel (ver el documento de producto para el detalle de por qué y cuándo
eso deja de ser así).
