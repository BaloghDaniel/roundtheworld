-- A column-level REVOKE does not override a table-wide UPDATE grant: Postgres
-- keeps the broader privilege and the narrower revoke is silently ineffective.
-- The table grant has to go, replaced by an explicit column list.

revoke update on public.profiles from authenticated;

grant update (display_name, avatar_url, handle, home_point, updated_at)
  on public.profiles to authenticated;

-- Undo the escalation the failed attempt actually performed.
update public.profiles set is_admin = false
where id <> 'a1e4d334-4a70-4619-8b18-2cecccb2cda3';
