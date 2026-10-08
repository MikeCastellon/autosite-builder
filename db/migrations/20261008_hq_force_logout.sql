-- Genius HQ provisioning: session revocation.
--
-- HQ's manage-app-access calls this over the service role when an admin
-- revokes someone's Websites access or presses "Sign out everywhere". GoTrue
-- has no admin sign-out-by-id endpoint, so every HQ-provisioned app carries
-- this same SECURITY DEFINER function. Already-issued access tokens live out
-- their <=1h expiry; the refresh that would extend them is what this removes.
--
-- Service role only: nothing in the app itself should ever call it.
-- Applied 2026-10-08 (Supabase migration hq_force_logout).

create or replace function public.force_logout_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = uid;
  delete from auth.refresh_tokens where user_id = uid::text;
end;
$$;

revoke execute on function public.force_logout_user(uuid) from public, anon, authenticated;
grant execute on function public.force_logout_user(uuid) to service_role;
