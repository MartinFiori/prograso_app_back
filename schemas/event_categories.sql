-- =========================================================
-- 4. CATEGORÍAS DE EVENTOS
-- =========================================================

create table public.event_categories (
  id bigint generated always as identity primary key,

  name text not null,
  description text,
  image_url text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_categories_name_unique
    unique (name)
);