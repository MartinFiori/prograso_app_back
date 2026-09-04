-- =========================================================
-- 3. ESTADOS DE INSCRIPCIONES
-- =========================================================

create table public.registration_statuses (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.registration_statuses (
  code,
  name,
  description
)
values
  (
    'confirmed',
    'Confirmada',
    'El usuario tiene un lugar confirmado.'
  ),
  (
    'waitlisted',
    'En lista de espera',
    'El usuario está esperando que se libere un lugar.'
  ),
  (
    'cancelled',
    'Cancelada',
    'La inscripción fue cancelada.'
  )
on conflict (code) do nothing;