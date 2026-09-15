begin;

do $$
begin
  if exists (
    select 1
    from public.event_registrations
    where registration_group_id is not null
  ) then
    raise exception 'Rollback cancelled: paired registrations still exist';
  end if;
end;
$$;

drop function if exists public.admin_delete_pair_registration(bigint);
drop function if exists public.unregister_pair_from_event(bigint);
drop function if exists public.register_pair_for_event(bigint, uuid);
drop function if exists private.rebalance_event_waitlist(bigint);

alter table public.event_registrations
  drop column if exists registration_group_id;

drop table if exists public.event_registration_groups;

alter table public.event_categories
  drop column if exists participants_per_registration;

commit;
