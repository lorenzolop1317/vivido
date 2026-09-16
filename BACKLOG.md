# Backlog

Los cuatro puntos que estaban acá (portada del evento, footer, cámara vs.
galería, y comprimir fotos para la web) ya se implementaron. Quedan estas
notas sueltas para más adelante:

## Pendiente / a evaluar
- **Rotar el token de API de R2** que se compartió en el chat en algún momento
  de las pruebas (buena práctica, no urgente mientras el bucket sea de prueba).
- ~~**Marca blanca / versión para otra empresa**~~ — implementado: soporte
  multi-marca dentro de la misma app (`lib/brands.ts`, `/divine-tables`,
  columna `brand` en `albums`). Vívido y Divine Tables conviven en el mismo
  proyecto de Vercel/Supabase/R2.
- ~~**PWA con manifest por marca**~~ — implementado: Divine Tables tiene su
  propio ícono (`public/brands/divine-tables/icon-192.png`/`icon-512.png`) y
  manifest (`public/brands/divine-tables/manifest.webmanifest`), aplicado vía
  `generateMetadata` en `app/a/[token]/page.tsx` (según la marca del álbum) y
  en `app/divine-tables/page.tsx`. "Agregar a inicio" desde un álbum o la
  página de creación de Divine Tables ahora usa su logo y nombre, no los de
  Vívido. Vívido no se tocó (sigue heredando el manifest de `app/layout.tsx`).
- ~~**Tope de almacenamiento editable por álbum**~~ — implementado: el panel
  de super usuario deja subir/bajar el límite de un álbum puntual desde un
  campo numérico libre en cada tarjeta (con selector GB/MB, para poder pedir
  cualquier valor — 3, 4, 5 GB... o una cifra puntual en MB), entre 512 MB y
  20 GB (`setAlbumStorageLimit` en `lib/albums.ts`, PATCH en
  `app/api/admin/albums/[id]/route.ts`; primero se probó con presets fijos
  de 3/5/7/10/15/20 GB pero se cambió a campo libre porque no daba el
  control fino que hacía falta para administrar el espacio entre álbumes).
  Sigue siendo manual álbum por álbum — no hay una alarma automática si la
  suma de todos los álbumes se acerca a la capa gratis de R2 (10 GB), solo
  el visor de espacio total que ya existía en el panel.
- ~~**Descargar el contenido de un álbum desde el panel de admin**~~ —
  implementado: botón "Download Data" en cada tarjeta del panel, que arma y
  descarga un .zip con todo lo que subieron los invitados (reusa el mismo
  endpoint de exportación que ya usaba el organizador desde su propio álbum,
  `app/api/albums/[token]/export/route.ts`).
- ~~**QR del enlace de invitados**~~ — implementado: en la pantalla de "álbum
  creado", el enlace de invitados tiene un botón "Ver código QR" que genera
  el QR en el momento (librería `qrcode`, cliente) y permite descargarlo como
  PNG. No se guarda en la base — se regenera cada vez a partir del enlace.
- **Panel de admin — mejoras posibles**: hoy es una sola pantalla con lista +
  toggles + borrado (`app/page.tsx`, `lib/albums.ts`). Si hace falta más
  adelante: paginación (si hay muchos álbumes), edición de nombre/fecha desde
  el panel, un botón de "archivar ahora" manual sin esperar la retención, o
  una alarma cuando el total se acerca al límite de la capa gratis de R2.
- **Videos**: la copia liviana para la galería hoy es solo para fotos. Si el
  peso de los videos en el feed se vuelve un problema, se podría generar un
  thumbnail/preview corto del video (no el archivo completo) para la
  miniatura, manteniendo el video original intacto para reproducir/descargar.
- **Envío de mails real** para el formulario de contacto del footer: hoy los
  mensajes solo se guardan en la tabla `contact_messages` de Supabase (se
  revisan desde ahí). Conectar un servicio (Resend, SendGrid, etc.) cuando
  haga falta notificación por email.
- ~~**Formulario de contacto solo donde corresponde, en Divine Tables**~~ —
  implementado (`components/Footer.tsx`, prop `showContactForm`): en la
  página de creación (`/divine-tables`) ya no aparece el formulario "¿Nos
  escribís?" — solo el logo, slogan, redes y copyright, reacomodados en una
  columna centrada en vez de quedar pegados a la izquierda con un hueco al
  lado. Dentro de un álbum de Divine Tables, el formulario solo se muestra
  para quien entra como invitado o a mirar (roles `contributor`/`viewer`) —
  quien organiza o modera no lo ve. Vívido no se tocó: sigue mostrando el
  formulario en todos lados como siempre (el prop por defecto es `true`).
  De paso se corrigieron dos frases que sonaban marcadamente argentinas
  ("¿Nos escribís?" → "Escríbenos", "Contanos en qué te podemos ayudar" →
  "Cuéntanos en qué te podemos ayudar") **solo para Divine Tables** — el
  diccionario `es` de `lib/i18n.ts` es compartido con Vívido y no se tocó,
  así que estos dos casos se resuelven con un pequeño override dentro de
  `Footer.tsx` en vez de editar el diccionario. Si más adelante aparecen
  más frases con voseo en el resto del texto de Divine Tables (fuera del
  footer) y hace falta neutralizarlas también, conviene entonces sí separar
  un diccionario "es" propio para Divine Tables en `lib/i18n.ts` en vez de
  seguir sumando overrides sueltos componente por componente.
- ~~**Envío masivo por email a la lista de invitados**~~ — implementado
  (`lib/mailer.ts`, `lib/emailTemplates.ts`, `lib/guestList.ts`,
  `app/api/albums/[token]/invite-emails/route.ts`, `components/InviteEmailPanel.tsx`):
  desde la pantalla de "álbum creado", subís un Excel/CSV con nombre + email,
  configurás asunto/remitente/texto en un popup, y se manda uno por uno con
  el look de la marca + QR + enlace. Soporta dos proveedores — `lib/mailer.ts`
  elige automáticamente según qué variables estén cargadas: **Gmail** (una
  cuenta de Gmail + contraseña de aplicación, sin dominio propio — la que
  estás usando ahora en la fase beta) o **Resend** (mejor entregabilidad,
  para cuando en algún momento haya un dominio propio verificado). Ver
  README, "Puesta en marcha" → paso 3, para el paso a paso de cualquiera de
  las dos. Sin ninguna configurada, el botón de enviar avisa que falta
  configurarlo, no rompe nada.
  Nota técnica: el parseo del Excel corre en el navegador con la librería
  `xlsx` de npm, que tiene un advisory de seguridad conocido (sin parche en
  el registro de npm) — el riesgo real acá es mínimo porque es siempre el
  propio organizador leyendo su propio archivo en su propio navegador, nunca
  un archivo de terceros ni nada que toque el servidor. Si más adelante hace
  falta subir el estándar de seguridad, reemplazar por la build oficial de
  SheetJS (cdn.sheetjs.com) en vez de la de npm.
  Pendiente para más adelante: hoy no hay forma de "guardar" la lista de
  invitados entre sesiones (si recargás la pantalla de creación la perdés) —
  si hace falta reenviar días después, habría que guardar la lista en la
  base en vez de solo en la sesión del navegador. (Los enlaces del álbum en
  sí ya no se pierden más — ver el punto siguiente.)
- ~~**Recuperar los enlaces/QR de un álbum si se pierden**~~ — implementado:
  la pantalla de "álbum creado" (los tres enlaces + QR + envío de
  invitaciones) se extrajo a un componente propio (`components/AlbumLinksView.tsx`)
  que ahora se reusa en dos lugares: justo después de crear el álbum (como
  siempre) y en la nueva ruta `app/links/[token]/page.tsx`, que muestra lo
  mismo a partir del token de organizador en cualquier momento posterior. El
  panel de super usuario tiene un botón "Enlaces Web" por álbum
  (`components/AdminDashboard.tsx`) que lleva ahí (se abre en pestaña nueva).
  La página solo acepta el token de **organizador** — `resolveToken` +
  chequeo de `role === 'organizer'`, si no da 404 — y de ahí busca los otros
  dos tokens con `getAllRoleTokens` (`lib/albums.ts`). No hace falta guardar
  nada nuevo en la base: los tres tokens ya existían desde que se crea el
  álbum, antes simplemente no había una pantalla para volver a verlos.
  Sigue sin haber una entrada de "ver enlaces" pensada para que el propio
  organizador se las arregle solo (hoy depende de vos, Lorenzo, compartiendo
  el link de `/links/<token>` si alguien te escribe pidiendo recuperarlos) —
  si hace falta más adelante, se podría agregar un botón similar dentro del
  álbum mismo para quien entra como organizador.
