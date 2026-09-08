-- Esquema inicial. Pegar y ejecutar en el SQL Editor del proyecto de Supabase.
-- Ver README.md para el paso a paso completo de configuración.

create extension if not exists "pgcrypto";

create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  location text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  storage_limit_bytes bigint not null default 3221225472, -- 3 GB (plan free)
  video_max_seconds int default 60, -- null = sin límite (plan pago)
  upload_window_days int default 14, -- null = sin ventana fija (plan pago)
  retention_days int default 30, -- null = retención indefinida (plan pago)
  cover_image_key text, -- imagen de portada ("membrete") del álbum, opcional
  created_at timestamptz not null default now()
);

-- Por si esta tabla ya existía de una versión anterior sin esta columna:
alter table albums add column if not exists cover_image_key text;

create table if not exists album_tokens (
  token text primary key,
  album_id uuid not null references albums(id) on delete cascade,
  role text not null check (role in ('organizer', 'moderator', 'contributor', 'viewer')),
  label text,
  created_at timestamptz not null default now()
);

create index if not exists album_tokens_album_id_idx on album_tokens(album_id);

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  r2_key text not null unique, -- archivo ORIGINAL, máxima calidad (se usa para descargar)
  r2_key_display text, -- copia liviana opcional para mostrar en la web (solo fotos grandes); si es null, se usa r2_key
  kind text not null check (kind in ('photo', 'video')),
  content_type text not null,
  size_bytes bigint not null, -- peso del archivo ORIGINAL
  display_size_bytes bigint, -- peso de la copia liviana (r2_key_display), si existe
  duration_seconds numeric,
  width int,
  height int,
  uploaded_by_token text references album_tokens(token) on delete set null,
  uploader_device_id text, -- id anónimo generado en el navegador de quien subió (ver lib/albums.ts)
  uploader_label text,
  created_at timestamptz not null default now()
);

-- Por si esta tabla ya existía de una versión anterior sin estas columnas:
alter table media add column if not exists width int;
alter table media add column if not exists height int;
alter table media add column if not exists r2_key_display text;
alter table media add column if not exists display_size_bytes bigint;

create index if not exists media_album_id_idx on media(album_id);
create index if not exists media_album_created_idx on media(album_id, created_at desc);

create table if not exists media_likes (
  media_id uuid not null references media(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (media_id, device_id)
);

create index if not exists media_likes_media_id_idx on media_likes(media_id);

-- Mensajes del formulario de contacto del pie de página (ver components/Footer.tsx).
-- Se guardan acá para no depender de un servicio de envío de mails todavía;
-- se pueden revisar desde el Table Editor de Supabase.
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security queda deshabilitada a propósito: todo el acceso pasa por las
-- API routes de Next.js usando la Service Role Key (ver lib/supabase.ts). Los
-- invitados no tienen sesión de Supabase — su "permiso" es poseer el token de la URL.
-- Si más adelante se agrega login real de organizador con Supabase Auth, ahí sí
-- conviene habilitar RLS para ese camino.
