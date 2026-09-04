-- =========================================================
-- RPCs de inscripciones (transaccionales)
-- Aplicar después de events, event_registrations y registration_statuses
-- =========================================================

create schema if not exists private;

-- ---------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant usage on schema private to authenticated;

create or replace function private.reorder_waitlist(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_registrations
  set waitlist_position = 1000000000 + waitlist_position
  where event_id = p_event_id
    and status_code = 'waitlisted';

  update public.event_registrations as registration
  set waitlist_position = numbered.rn
  from (
    select
      id,
      row_number() over (order by waitlist_position, id) as rn
    from public.event_registrations
    where event_id = p_event_id
      and status_code = 'waitlisted'
  ) as numbered
  where registration.id = numbered.id;
end;
$$;

revoke all on function private.reorder_waitlist(bigint) from public, anon, authenticated;

create or replace function private.promote_first_waitlisted(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_registrations
  set
    status_code = 'confirmed',
    waitlist_position = null
  where id = (
    select id
    from public.event_registrations
    where event_id = p_event_id
      and status_code = 'waitlisted'
    order by waitlist_position asc, id asc
    limit 1
  );
end;
$$;

revoke all on function private.promote_first_waitlisted(bigint) from public, anon, authenticated;

create or replace function private.lock_event(p_event_id bigint)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  return v_event;
end;
$$;

revoke all on function private.lock_event(bigint) from public, anon, authenticated;

create or replace function private.assert_event_accepts_registrations(p_event public.events)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event.status_code is distinct from 'open' then
    raise exception 'event_not_open';
  end if;

  if p_event.registration_deadline is not null
     and p_event.registration_deadline <= now() then
    raise exception 'registration_deadline_expired';
  end if;
end;
$$;

revoke all on function private.assert_event_accepts_registrations(public.events) from public, anon, authenticated;

create or replace function private.register_user_for_event(
  p_event_id bigint,
  p_user_id uuid
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_confirmed_count integer;
  v_next_position integer;
  v_row public.event_registrations%rowtype;
begin
  if p_user_id is null then
    raise exception 'authentication_required';
  end if;

  v_event := private.lock_event(p_event_id);
  perform private.assert_event_accepts_registrations(v_event);

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
    raise exception 'profile_not_found';
  end if;

  if exists (
    select 1
    from public.event_registrations
    where event_id = p_event_id
      and user_id = p_user_id
  ) then
    raise exception 'registration_already_exists';
  end if;

  select count(*)
  into v_confirmed_count
  from public.event_registrations
  where event_id = p_event_id
    and status_code = 'confirmed';

  begin
    if v_confirmed_count < v_event.capacity then
      insert into public.event_registrations (
        event_id,
        user_id,
        status_code,
        waitlist_position
      )
      values (
        p_event_id,
        p_user_id,
        'confirmed',
        null
      )
      returning * into v_row;
    else
      select coalesce(max(waitlist_position), 0) + 1
      into v_next_position
      from public.event_registrations
      where event_id = p_event_id
        and status_code = 'waitlisted';

      insert into public.event_registrations (
        event_id,
        user_id,
        status_code,
        waitlist_position
      )
      values (
        p_event_id,
        p_user_id,
        'waitlisted',
        v_next_position
      )
      returning * into v_row;
    end if;
  exception
    when unique_violation then
      if position('event_registrations_event_user_unique' in sqlerrm) > 0 then
        raise exception 'registration_already_exists';
      end if;

      if position('event_waitlist_position_unique' in sqlerrm) > 0 then
        raise exception 'waitlist_position_conflict';
      end if;

      raise exception 'registration_already_exists';
  end;

  return v_row;
end;
$$;

revoke all on function private.register_user_for_event(bigint, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- RPCs de usuario (auth.uid())
-- ---------------------------------------------------------

create or replace function public.register_for_event(p_event_id bigint)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.register_user_for_event(p_event_id, (select auth.uid()));
end;
$$;

revoke all on function public.register_for_event(bigint) from public, anon;
grant execute on function public.register_for_event(bigint) to authenticated;

create or replace function public.unregister_from_event(p_event_id bigint)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.event_registrations%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  perform private.lock_event(p_event_id);

  delete from public.event_registrations
  where event_id = p_event_id
    and user_id = v_user_id
  returning * into v_row;

  if not found then
    raise exception 'registration_not_found';
  end if;

  if v_row.status_code = 'confirmed' then
    perform private.promote_first_waitlisted(p_event_id);
  end if;

  perform private.reorder_waitlist(p_event_id);

  return v_row;
end;
$$;

revoke all on function public.unregister_from_event(bigint) from public, anon;
grant execute on function public.unregister_from_event(bigint) to authenticated;

-- ---------------------------------------------------------
-- RPCs administrativas
-- ---------------------------------------------------------

create or replace function public.admin_register_for_event(
  p_event_id bigint,
  p_user_id uuid
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_user_id is null then
    raise exception 'profile_not_found';
  end if;

  return private.register_user_for_event(p_event_id, p_user_id);
end;
$$;

revoke all on function public.admin_register_for_event(bigint, uuid) from public, anon;
grant execute on function public.admin_register_for_event(bigint, uuid) to authenticated;

create or replace function public.admin_update_registration(
  p_registration_id bigint,
  p_patch jsonb
)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations%rowtype;
  v_event public.events%rowtype;
  v_next_status text;
  v_next_position integer;
  v_position_provided boolean;
  v_confirmed_count integer;
  v_taken boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_patch is null or p_patch = '{}'::jsonb then
    raise exception 'invalid_registration_status';
  end if;

  select *
  into v_row
  from public.event_registrations
  where id = p_registration_id;

  if not found then
    raise exception 'registration_not_found';
  end if;

  v_event := private.lock_event(v_row.event_id);
  perform private.assert_event_accepts_registrations(v_event);

  select *
  into v_row
  from public.event_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'registration_not_found';
  end if;

  v_next_status := coalesce(p_patch->>'status_code', v_row.status_code);

  if v_next_status not in ('confirmed', 'waitlisted') then
    raise exception 'invalid_registration_status';
  end if;

  if not exists (
    select 1
    from public.registration_statuses
    where code = v_next_status
  ) then
    raise exception 'invalid_registration_status';
  end if;

  v_position_provided := p_patch ? 'waitlist_position';

  if v_position_provided then
    if jsonb_typeof(p_patch->'waitlist_position') = 'null'
       or p_patch->>'waitlist_position' is null then
      v_next_position := null;
    else
      begin
        v_next_position := (p_patch->>'waitlist_position')::integer;
      exception
        when invalid_text_representation then
          raise exception 'invalid_waitlist_position';
      end;
    end if;
  else
    v_next_position := v_row.waitlist_position;
  end if;

  if v_next_status = 'confirmed' then
    if v_next_position is not null then
      raise exception 'invalid_waitlist_position';
    end if;

    if v_row.status_code is distinct from 'confirmed' then
      select count(*)
      into v_confirmed_count
      from public.event_registrations
      where event_id = v_row.event_id
        and status_code = 'confirmed';

      if v_confirmed_count >= v_event.capacity then
        raise exception 'event_capacity_full';
      end if;
    end if;

    update public.event_registrations
    set
      status_code = 'confirmed',
      waitlist_position = null
    where id = v_row.id
    returning * into v_row;

    perform private.reorder_waitlist(v_row.event_id);

    return v_row;
  end if;

  if v_next_position is null then
    if v_row.status_code = 'waitlisted' then
      v_next_position := v_row.waitlist_position;
    else
      select coalesce(max(waitlist_position), 0) + 1
      into v_next_position
      from public.event_registrations
      where event_id = v_row.event_id
        and status_code = 'waitlisted';
    end if;
  end if;

  if v_next_position is null or v_next_position <= 0 then
    raise exception 'invalid_waitlist_position';
  end if;

  select exists (
    select 1
    from public.event_registrations
    where event_id = v_row.event_id
      and status_code = 'waitlisted'
      and waitlist_position = v_next_position
      and id is distinct from v_row.id
  )
  into v_taken;

  if v_taken then
    raise exception 'waitlist_position_conflict';
  end if;

  if v_row.status_code = 'waitlisted' then
    update public.event_registrations
    set waitlist_position = 1000000000 + id
    where id = v_row.id;
  end if;

  update public.event_registrations
  set
    status_code = 'waitlisted',
    waitlist_position = v_next_position
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_update_registration(bigint, jsonb) from public, anon;
grant execute on function public.admin_update_registration(bigint, jsonb) to authenticated;

create or replace function public.admin_delete_registration(p_registration_id bigint)
returns public.event_registrations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_registrations%rowtype;
  v_event_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  if not private.is_admin() then
    raise exception 'admin_required';
  end if;

  select *
  into v_row
  from public.event_registrations
  where id = p_registration_id;

  if not found then
    raise exception 'registration_not_found';
  end if;

  v_event_id := v_row.event_id;
  perform private.lock_event(v_event_id);

  delete from public.event_registrations
  where id = p_registration_id
  returning * into v_row;

  if not found then
    raise exception 'registration_not_found';
  end if;

  if v_row.status_code = 'confirmed' then
    perform private.promote_first_waitlisted(v_event_id);
  end if;

  perform private.reorder_waitlist(v_event_id);

  return v_row;
end;
$$;

revoke all on function public.admin_delete_registration(bigint) from public, anon;
grant execute on function public.admin_delete_registration(bigint) to authenticated;
