-- =========================================================
-- 1. PERFILES
-- Extiende auth.users con información propia de la aplicación
-- =========================================================

create table public.profiles (
  id uuid primary key
    references auth.users(id) on delete cascade,

  role text not null default 'user'
    check (role in ('admin', 'user')),

  name text not null,
  avatar_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);