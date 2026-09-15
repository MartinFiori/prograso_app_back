begin;

alter table public.events
  add column if not exists end_at timestamptz;

update public.events
set end_at = starts_at + interval '2 hours'
where end_at is null;

alter table public.events
  alter column end_at set not null;

alter table public.events
  drop constraint if exists events_time_range_valid;

alter table public.events
  add constraint events_time_range_valid
  check (end_at > starts_at);

create or replace function private.assert_event_accepts_registrations(
  p_event public.events
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event.status_code is distinct from 'open' then
    raise exception 'event_not_open';
  end if;

  if p_event.starts_at <= now() then
    raise exception 'event_already_started';
  end if;
end;
$$;

revoke all on function private.assert_event_accepts_registrations(public.events)
  from public, anon, authenticated;

alter table public.events
  drop constraint if exists events_registration_deadline_valid;

alter table public.events
  drop column if exists registration_deadline;

commit;
