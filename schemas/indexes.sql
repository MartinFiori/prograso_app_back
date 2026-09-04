create index events_category_id_idx
  on public.events(category_id);

create index events_status_starts_at_idx
  on public.events(status_code, starts_at);

create index events_created_by_idx
  on public.events(created_by);

create index event_registrations_user_id_idx
  on public.event_registrations(user_id);

create index event_registrations_event_status_idx
  on public.event_registrations(event_id, status_code);

create unique index event_waitlist_position_unique_idx
  on public.event_registrations(event_id, waitlist_position)
  where status_code = 'waitlisted';