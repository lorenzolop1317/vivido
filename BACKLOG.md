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
  proyecto de Vercel/Supabase/R2. Si en algún momento Divine Tables necesita
  su propio dominio o manifest de PWA instalable, ver la nota de "fuera de
  alcance" en el README.
- **PWA con manifest por marca**: hoy `/divine-tables` usa el mismo
  `manifest.json`/ícono de "agregar a inicio" que Vívido (ver limitación en
  README). Si Divine Tables necesita instalarse como app propia, requiere
  reestructurar `app/layout.tsx` o separar en otra ruta con su propio manifest.
- **Panel de admin — mejoras posibles**: hoy es una sola pantalla con lista +
  toggle + borrado (`app/admin/[secret]`, `lib/albums.ts`). Si hace falta más
  adelante: paginación (si hay muchos álbumes), edición de nombre/fecha desde
  el panel, o un botón de "archivar ahora" manual sin esperar la retención.
- **Videos**: la copia liviana para la galería hoy es solo para fotos. Si el
  peso de los videos en el feed se vuelve un problema, se podría generar un
  thumbnail/preview corto del video (no el archivo completo) para la
  miniatura, manteniendo el video original intacto para reproducir/descargar.
- **Envío de mails real** para el formulario de contacto del footer: hoy los
  mensajes solo se guardan en la tabla `contact_messages` de Supabase (se
  revisan desde ahí). Conectar un servicio (Resend, SendGrid, etc.) cuando
  haga falta notificación por email.
