# Backlog

Los cuatro puntos que estaban acá (portada del evento, footer, cámara vs.
galería, y comprimir fotos para la web) ya se implementaron. Quedan estas
notas sueltas para más adelante:

## Pendiente / a evaluar
- **Rotar el token de API de R2** que se compartió en el chat en algún momento
  de las pruebas (buena práctica, no urgente mientras el bucket sea de prueba).
- **Marca blanca / versión para otra empresa** (ej. la del picnic en Central
  Park): una vez que el flujo esté bien probado, definir si conviene una
  instancia separada (otro proyecto de Vercel/Supabase/R2, mismo código, otra
  marca) o soporte multi-marca dentro de la misma app (branding por álbum o
  por cuenta de organizador). Se decide cuando llegue el momento.
- **Videos**: la copia liviana para la galería hoy es solo para fotos. Si el
  peso de los videos en el feed se vuelve un problema, se podría generar un
  thumbnail/preview corto del video (no el archivo completo) para la
  miniatura, manteniendo el video original intacto para reproducir/descargar.
- **Envío de mails real** para el formulario de contacto del footer: hoy los
  mensajes solo se guardan en la tabla `contact_messages` de Supabase (se
  revisan desde ahí). Conectar un servicio (Resend, SendGrid, etc.) cuando
  haga falta notificación por email.
