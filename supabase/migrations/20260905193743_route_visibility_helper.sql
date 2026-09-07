-- Route visibility was spelled out separately in three policies and one
-- function, and fixing it in one place left the others owner-only: the journey
-- appeared but its geometry came back empty. One helper, used everywhere.

create or replace function public.can_read_route(p_route_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.routes r
    where r.id = p_route_id
      and (
        r.owner_id is null                       -- shared, e.g. the world route
        or r.owner_id = auth.uid()               -- your own goal route
        or exists (                              -- a route your group runs on
          select 1
          from public.journey_groups g
          join public.journey_group_members m on m.group_id = g.id
          where g.route_id = r.id
            and m.user_id = auth.uid()
            and m.status <> 'declined'
        )
      )
  );
$$;
revoke all on function public.can_read_route(uuid) from public, anon, authenticated;
grant execute on function public.can_read_route(uuid) to authenticated;

drop policy if exists "read shared or own routes" on public.routes;
drop policy if exists "read routes used by your groups" on public.routes;
create policy "read routes you can see"
  on public.routes for select to authenticated
  using (public.can_read_route(id));

drop policy if exists "read segments of visible routes" on public.route_segments;
create policy "read segments of visible routes"
  on public.route_segments for select to authenticated
  using (public.can_read_route(route_id));

drop policy if exists "read landmarks of visible routes" on public.route_landmarks;
create policy "read landmarks of visible routes"
  on public.route_landmarks for select to authenticated
  using (public.can_read_route(route_id));
