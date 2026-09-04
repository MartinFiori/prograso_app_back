-- =========================================================
-- 5. EVENTOS
-- =========================================================

create table public.events (
  id bigint generated always as identity primary key,

  category_id bigint not null
    references public.event_categories(id)
    on delete restrict,

  title text not null,

  starts_at timestamptz not null,
  registration_deadline timestamptz,

  capacity integer not null,

  status_code text not null default 'draft'
    references public.event_statuses(code)
    on update cascade
    on delete restrict,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_capacity_positive
    check (capacity > 0),

  constraint events_registration_deadline_valid
    check (
      registration_deadline is null
      or registration_deadline <= starts_at
    )
);