-- An admin flag, and a lock so it cannot be self-granted.
--
-- The "update own profile" policy allows a user to write their own row, which
-- means every column on it. Without a column-level revoke, adding is_admin
-- would hand every user a one-line privilege escalation.

alter table public.profiles add column is_admin boolean not null default false;

revoke update (is_admin, id) on public.profiles from authenticated;

comment on column public.profiles.is_admin is
  'Grantable only by the service role. UPDATE on this column is revoked from '
  'authenticated, because the row-level policy would otherwise let anyone set it.';

update public.profiles set is_admin = true
where id = 'a1e4d334-4a70-4619-8b18-2cecccb2cda3';

/** Whether the caller is an admin, for showing admin-only UI. */
create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.am_i_admin() from public, anon, authenticated;
grant execute on function public.am_i_admin() to authenticated;
