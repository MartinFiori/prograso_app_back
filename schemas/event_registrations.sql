-- =========================================================
-- 6. INSCRIPCIONES
-- =========================================================

create table public.event_registrations (
  id bigint generated always as identity primary key,

  event_id bigint not null
    references public.events(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status_code text not null default 'confirmed'
    references public.registration_statuses(code)
    on update cascade
    on delete restrict,

  waitlist_position integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_registrations_event_user_unique
    unique (event_id, user_id),

  constraint event_registrations_waitlist_position_valid
    check (
      (
        status_code = 'waitlisted'
        and waitlist_position is not null
        and waitlist_position > 0
      )
      or
      (
        status_code <> 'waitlisted'
        and waitlist_position is null
      )
    )
);