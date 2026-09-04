-- =========================================================
-- 2. ESTADOS DE EVENTOS
-- =========================================================

create table public.event_statuses (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.event_statuses (
  code,
  name,
  description
)
values
  (
    'draft',
    'Borrador',
    'El evento todavía no fue publicado.'
  ),
  (
    'open',
    'Inscripciones abiertas',
    'El evento permite nuevas inscripciones.'
  ),
  (
    'closed',
    'Inscripciones cerradas',
    'El evento ya no permite inscripciones.'
  ),
  (
    'cancelled',
    'Cancelado',
    'El evento fue cancelado.'
  ),
  (
    'completed',
    'Finalizado',
    'El evento ya se realizó.'
  );