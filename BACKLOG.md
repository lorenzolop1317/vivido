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
  de super usuario deja subir/bajar el límite de un álbum puntual (presets de
  3 a 20 GB) desde un selector en cada tarjeta (`setAlbumStorageLimit` en
  `lib/albums.ts`, PATCH en `app/api/admin/albums/[id]/route.ts`). Sigue
  siendo manual álbum por álbum — no hay una alarma automática si la suma de
  todos los álbumes se acerca a la capa gratis de R2 (10 GB), solo el visor
  de espacio total que ya existía en el panel.
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
- ~~**Envío masivo por email a la lista de invitados**~~ — implementado con
  Resend (`lib/mailer.ts`, `lib/emailTemplates.ts`, `lib/guestList.ts`,
  `app/api/albums/[token]/invite-emails/route.ts`, `components/InviteEmailPanel.tsx`):
  desde la pantalla de "álbum creado", subís un Excel/CSV con nombre + email,
  configurás asunto/remitente/texto en un popup, y se manda uno por uno con
  el look de la marca + QR + enlace. Pendiente de tu lado: crear la cuenta de
  Resend y verificar un dominio (ver README, "Puesta en marcha" → paso 3) —
  sin eso el botón de enviar avisa que falta configurarlo, no rompe nada.
  Nota técnica: el parseo del Excel corre en el navegador con la librería
  `xlsx` de npm, que tiene un advisory de seguridad conocido (sin parche en
  el registro de npm) — el riesgo real acá es mínimo porque es siempre el
  propio organizador leyendo su propio archivo en su propio navegador, nunca
  un archivo de terceros ni nada que toque el servidor. Si más adelante hace
  falta subir el estándar de seguridad, reemplazar por la build oficial de
  SheetJS (cdn.sheetjs.com) en vez de la de npm.
  Pendiente para más adelante: hoy no hay forma de "guardar" la lista de
  invitados entre sesiones (si recargás la pantalla de creación la perdés,
  igual que ya pasaba con el enlace de invitados) — si hace falta reenviar
  días después, habría que guardar la lista en la base en vez de solo en la
  sesión del navegador.
