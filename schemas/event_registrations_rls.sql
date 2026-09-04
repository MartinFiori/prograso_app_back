-- =========================================================
-- RLS de event_registrations
-- Mutaciones solo vía RPC SECURITY DEFINER
-- =========================================================

alter table public.event_registrations enable row level security;

revoke insert, update, delete on table public.event_registrations from public, anon, authenticated;
grant select on table public.event_registrations to authenticated;

drop policy if exists event_registrations_select_own on public.event_registrations;
create policy event_registrations_select_own
on public.event_registrations
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists event_registrations_select_admin on public.event_registrations;
create policy event_registrations_select_admin
on public.event_registrations
for select
to authenticated
using (private.is_admin());
