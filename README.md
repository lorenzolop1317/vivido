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
  page.tsx              panel de super usuario (login + dashboard) — vive en la URL base
  vivido/page.tsx       crear álbum (Vívido) — antes vivía en "/", se movió acá sin tocarlo
  divine-tables/page.tsx crear álbum (Divine Tables — mismo flujo, otra marca, con selector ES/EN)
  a/[token]/page.tsx     vista del álbum (se adapta según el rol del enlace y la marca)
  api/                   endpoints usados por los componentes cliente
  api/admin/             login/logout (cookie de sesión) + endpoints del panel (retención, borrado)
components/
  CreateAlbumForm.tsx    formulario de creación (cliente), acepta marca + idioma como prop
  InviteEmailPanel.tsx   subir lista de invitados y mandarles la invitación por email (cliente)
  AlbumWorkspace.tsx     subida, galería, portada y moderación (cliente), bilingüe para Divine Tables
  AdminLogin.tsx         formulario de login del panel de super usuario
  AdminDashboard.tsx     lista de álbumes, espacio usado, toggle de retención y borrado completo
  LanguageToggle.tsx     selector ES/EN (solo se muestra en Divine Tables)
  BrandTheme.tsx         pisa los colores/tipografía de marca en el navegador según el álbum
  Footer.tsx             pie de página (contacto, copyright, logo) — en todas las páginas
lib/
  albums.ts              toda la lógica de negocio (roles, límites, ventanas, portada, admin)
  brands.ts              configuración de cada marca (colores, logo, contacto) — Vívido/Divine Tables
  admin-auth.ts          login por contraseña (ADMIN_SECRET) + cookie de sesión httpOnly firmada
  i18n.ts                diccionario ES/EN de Divine Tables (Vívido no lo usa, sigue en español)
  guestList.ts           lee el Excel/CSV de invitados (nombre + email), corre en el navegador
  mailer.ts              envío de emails vía Resend (server-only, necesita las env vars de abajo)
  emailTemplates.ts      arma el HTML del email de invitación (logo/colores de marca + QR)
  contact.ts              guarda los mensajes del formulario de contacto
  r2.ts                  integración con Cloudflare R2
  supabase.ts            cliente de Supabase (server-only)
  export.ts               armado del .zip para descarga (siempre con el archivo original)
  cleanup.ts              archivado de álbumes vencidos (retención, solo si está activada)
  limits.ts               los números del plan gratis + el techo de la capa gratis de R2 (panel admin)
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

### 3. Envío de invitaciones por email (opcional)
Sin este paso la app funciona igual; solo que el botón de "enviar invitaciones por email"
(pantalla de álbum creado) muestra un aviso en vez de mandar nada. Hay dos formas de activarlo
— alcanza con una de las dos:

**Opción A — Gmail (recomendado mientras no tengas un dominio propio, y no quieras pagar uno).**
No hace falta comprar nada, solo una cuenta de Gmail (puede ser una que ya uses, o una nueva
solo para esto):
1. Entrar a [myaccount.google.com/security](https://myaccount.google.com/security) y activar
   la **verificación en dos pasos** si todavía no la tenés activada (Google exige esto para
   poder generar el siguiente punto).
2. Ir a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), crear
   una "contraseña de aplicación" (elegí cualquier nombre, ej. "Vívido") y copiar el código de
   16 letras que te da — **no es** la contraseña normal de tu Gmail.
3. Variables de entorno: `GMAIL_USER` = tu dirección de Gmail completa, `GMAIL_APP_PASSWORD` =
   ese código de 16 letras (sin espacios).
4. Límite a tener en cuenta: Gmail deja mandar hasta ~500 emails por día por cuenta — de sobra
   para esta fase beta con vos como único super usuario y sin eventos simultáneos.

**Opción B — Resend (para más adelante, si en algún momento comprás un dominio propio).**
Da mejor entregabilidad (menos chance de caer en spam) y un tope de envío más alto, pero
necesita un dominio verificado — no se puede usar el subdominio gratuito de Vercel
(`vivido-eight.vercel.app`) porque no es un dominio del que tengas control del DNS:
1. Crear cuenta gratis en [resend.com](https://resend.com) (capa gratis: 3.000 emails/mes,
   100/día).
2. En **Domains**, agregar el dominio que compres (ej. `vivido.app`) y cargar en el DNS de
   donde lo compraste los 2-3 registros que Resend te muestra (SPF/DKIM).
   - Alcanza con verificar **un solo** dominio para las dos marcas: usás una dirección de ese
     dominio como remitente para ambas, y el nombre que ve el invitado sigue siendo el de la
     marca del álbum ("De: Divine Tables <invitaciones@vivido.app>"); las respuestas llegan al
     email de contacto de esa marca (`lib/brands.ts`), no al tuyo.
3. En **API Keys**, crear una → variable `RESEND_API_KEY`.
4. Una dirección de ese dominio verificado (ej. `invitaciones@vivido.app`) → variable
   `RESEND_FROM_EMAIL`.

Si cargás las dos opciones a la vez, la app usa Resend (queda como la opción "de arriba" para
cuando decidas pasarte).

### 4. Variables de entorno
Copiar `.env.example` a `.env.local` y completar los valores de los pasos anteriores, más un
`CRON_SECRET` y un `ADMIN_SECRET` inventados (dos textos largos y distintos, al azar — por
ejemplo con `openssl rand -hex 24`). Las de Resend son opcionales, ver el paso 3.

### 5. Correrlo en local
```bash
npm install
npm run dev
```
Abrir `http://localhost:3000`, crear un álbum de prueba y probar el flujo completo
(subir una foto, verla en la galería, borrarla, cerrar el álbum, descargar el zip).

### 6. Desplegar en Vercel
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

### Dónde vive cada cosa ahora (importante: esto cambió)

Para que nadie pueda simplemente "cortar" la URL de un álbum y llegar a la gestión, la base del
sitio (`https://tu-dominio/`) dejó de ser la página de creación de Vívido y ahora **es el panel
de super usuario**, protegido con una pantalla de login (contraseña = `ADMIN_SECRET`, la misma
variable de antes). La creación de álbumes se movió a rutas propias, iguales a como ya
funcionaba Divine Tables:
- **Crear álbum Vívido**: `https://tu-dominio/vivido` (antes era la URL base).
- **Crear álbum Divine Tables**: `https://tu-dominio/divine-tables` (sin cambios).
- **Panel de super usuario**: `https://tu-dominio/` (antes era `/admin/<ADMIN_SECRET>`).

Nada de esto cambia el flujo de un invitado: los enlaces de álbum (`/a/<token>`) son los mismos
de siempre y siguen sin necesitar login. Lo único que cambió es que ya no se puede "adivinar"
la URL de gestión borrando el final de un enlace de álbum — ahora esa URL es un login real.

El login ahora es un formulario (contraseña, no una URL secreta): entrás a `/`, escribís la
contraseña de `ADMIN_SECRET` y accedés. Por dentro queda una cookie de sesión (httpOnly, 30
días) — no hace falta volver a loguearse cada vez, y cerrar sesión es un botón dentro del panel.
Desde el panel podés:
- Ver todos los álbumes (de las dos marcas), cuánto espacio ocupa cada uno y cuándo se creó.
- Ver de un vistazo el espacio total usado contra el límite de la capa gratis de Cloudflare R2
  (10 GB) — es una estimación sumando lo que reportan los álbumes, no una consulta en vivo a la
  facturación de Cloudflare, pero es el mismo número que la app usa para frenar subidas (ver
  siguiente punto).
- **Tope global de 10 GB, aplicado automáticamente**: además del tope por álbum, hay un tope
  para toda la app junta (todos los álbumes, de cualquier marca) — si una subida haría que la
  suma de todo pase la capa gratis de R2, se rechaza sola, aunque ese álbum puntual todavía
  tenga lugar de sobra. Pensado para cuando alguien de afuera (ej. tu prima con Divine Tables)
  esté probando la app sin que eso pueda generar cobro extra de espacio mientras no haya un
  acuerdo. El número vive en un solo lugar (`INFRA_FREE_TIER.r2StorageBytes` en `lib/limits.ts`)
  — para subirlo el día que haga falta (plan pago, acuerdo comercial, etc.) alcanza con cambiar
  ese valor, no hay que tocar nada más.
- Crear un álbum nuevo de cualquiera de las dos marcas (botones directos a `/vivido` y
  `/divine-tables`).
- Subir (o bajar) el tope de almacenamiento de un álbum puntual — un campo numérico en cada
  tarjeta (con selector GB/MB) donde escribís directamente el número que quieras (3, 4, 5... o
  un valor puntual en MB si hace falta más precisión), entre 512 MB y 20 GB. Sigue siendo manual
  álbum por álbum (para darle más lugar a uno puntual si hace falta), pero ahora el tope global
  de arriba es la red de seguridad que evita pasarse de la capa gratis de R2 aunque te olvides de
  vigilarlo vos mismo. El valor se aplica al perder el foco del campo (o con Enter).
- Descargar directamente todas las fotos/videos que subieron los invitados de un álbum
  puntual (botón "Download Data" en cada tarjeta) — arma un .zip con los archivos originales,
  igual que el botón de descarga que ya tiene el organizador dentro de su propio álbum.
- Volver a ver los tres enlaces de un álbum (botón "Enlaces Web" en cada tarjeta, abre en una
  pestaña nueva) — la pantalla que se muestra justo después de crear un álbum (los tres enlaces
  + QR del enlace de invitados + envío de invitaciones por email) antes solo existía en ese
  momento: si el organizador la perdía, no había forma de recuperar el QR ni los enlaces de
  invitados/solo-ver (el de organizador sí se podía volver a copiar desde acá). Ahora esa misma
  pantalla vive en `/links/<token-de-organizador>` y se puede volver a abrir cuando haga falta.
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
- **Vívido** (`/vivido` para crear; `/a/<token>` para ver un álbum): el flujo, el texto y los
  colores quedan exactamente como estaban — el único cambio fue la URL de creación (ver arriba).
- **Divine Tables** (`/divine-tables`): página de creación con el logo, colores (verde oscuro
  `#1f3b26` / crema `#f4eade`) y tipografía de esa marca, pensada para que tu prima la use en
  sus eventos sin que aparezca "Vívido" en ningún lado. Tiene además un selector de idioma
  (ES/EN, arriba a la derecha) tanto en la página de creación como dentro del álbum completo
  (galería, subida, confirmaciones) — pensado para invitados de EE.UU. La preferencia de idioma
  de cada visitante se guarda en su propio navegador.

Toda la configuración de marca (nombre, colores, logo, tipografía, email de contacto,
Instagram) vive en un solo lugar: `lib/brands.ts`. Cada álbum guarda con qué marca se creó
(columna `brand` en `albums`), `components/BrandTheme.tsx` aplica los colores/tipografía
correctos en el navegador, y cada página (`/a/[token]`, `/divine-tables`) también ajusta el
color de la barra de estado del celular según la marca — sin duplicar ninguna clase de Tailwind
ni tocar el diseño de Vívido. El panel de admin (arriba) deja filtrar y gestionar los álbumes de
ambas marcas desde un mismo lugar.

"Agregar a inicio" también respeta la marca: `/divine-tables` y cualquier álbum de Divine
Tables (`/a/<token>`) usan su propio ícono y manifest (`public/brands/divine-tables/`), así que
el ícono que queda en el escritorio/pantalla de inicio es el logo de Divine Tables, no el de
Vívido. Esto se resuelve con `generateMetadata` en `app/a/[token]/page.tsx` — para un álbum de
Vívido esa función devuelve `{}` a propósito (sin overrides), así que Vívido sigue heredando
exactamente el manifest/ícono que ya definía `app/layout.tsx`, sin ningún cambio.

También hay, en la pantalla de "álbum creado" de cualquiera de las dos marcas, un botón para
generar y descargar un código QR del enlace de invitados (para imprimir o poner en una pantalla
del evento) — se genera en el momento en el navegador, no se guarda en ningún lado.

### Envío de invitaciones por email

En esa misma pantalla de "álbum creado" hay una sección para invitar por email a toda la lista
de golpe:
1. Subís un Excel (`.xlsx`) o CSV con columnas **Nombre** y **Email** (también entiende
   `Name`/`Email` en inglés) — se lee ahí mismo en el navegador, el archivo nunca se manda al
   servidor tal cual.
2. "Configurar mensaje" deja editar el asunto, el nombre del remitente y el texto (podés usar
   `{{nombre}}` donde quieras que aparezca el nombre de cada invitado) antes de mandar nada.
3. "Enviar a N invitados" le manda a cada uno un email con el look de la marca del álbum, el
   texto configurado, un botón con el enlace de invitados y el código QR — uno por uno, con
   una pequeña pausa entre cada envío para no pasarse del límite de la capa gratis de Resend.
4. Si algunos fallan (email inválido, límite de la cuenta, etc.), quedan listados con el motivo
   y hay un botón para reintentar solo esos.

Esto no queda guardado en ningún lado más allá de lo que dura la sesión en esa pantalla — si
recargás la página perdés la lista cargada (igual que ya pasaba con el enlace de invitados, que
solo se muestra una vez al crear el álbum). Necesita tener configurado Resend (ver "Puesta en
marcha" más arriba); sin eso, el botón de enviar avisa que todavía no está armado en vez de
fallar en silencio.

Pendiente de tu lado, sin bloquear nada: el diseño exacto del login y del pie del panel de
super usuario (colores/orden/información puntual) todavía es una versión funcional y prolija
pero no está calcado de ninguna referencia — cuando tengas esa imagen de referencia a mano la
sumamos y lo pulimos. El envío masivo de invitaciones por email (subir una lista de invitados y
mandarles el QR/enlace) está en definición — ver `BACKLOG.md`, necesita elegir un proveedor de
email antes de construirlo.

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
