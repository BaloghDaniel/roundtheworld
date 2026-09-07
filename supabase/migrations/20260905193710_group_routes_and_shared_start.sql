-- Two fixes for Tag Along.
--
-- 1. A goal route belongs to whoever created it, and the routes policy only
--    allowed the owner to read it. Everyone else in the group could hold a
--    journey on that route but never read the route itself, so my_journeys'
--    join dropped the row and the journey simply did not appear for them.
create policy "read routes used by your groups"
  on public.routes for select to authenticated
  using (exists (
    select 1
    from public.journey_groups g
    join public.journey_group_members m on m.group_id = g.id
    where g.route_id = routes.id
      and m.user_id = (select auth.uid())
      and m.status <> 'declined'
  ));

-- route_geometry carried the same owner-only test in its WHERE clause.
create or replace function public.route_geometry(p_route_id uuid)
returns jsonb language sql stable security invoker
set search_path = public, extensions as $$
  select jsonb_build_object(
    'slug', r.slug, 'name', r.name, 'isLoop', r.is_loop,
    'originName', r.origin_name, 'destinationName', r.destination_name,
    'totalDistanceM', r.total_distance_m,
    'segments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', s.mode, 'reason', s.reason, 'distanceM', s.distance_m,
        'cumStartM', s.cum_start_m, 'cumEndM', s.cum_end_m,
        'coords', (
          select jsonb_agg(jsonb_build_array(
            round(st_x(p.geom)::numeric, 5), round(st_y(p.geom)::numeric, 5)
          ) order by p.path)
          from (select (dp).geom as geom, (dp).path[1] as path
                from st_dumppoints(s.geom::geometry) dp) p
        )
      ) order by s.seq)
      from public.route_segments s where s.route_id = r.id
    ), '[]'::jsonb),
    'landmarks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', l.name, 'country', l.country, 'cumM', l.cum_m,
        'at', jsonb_build_array(round(st_x(l.geom::geometry)::numeric, 5),
                                round(st_y(l.geom::geometry)::numeric, 5))
      ) order by l.cum_m)
      from public.route_landmarks l where l.route_id = r.id
    ), '[]'::jsonb)
  )
  from public.routes r
  where r.id = p_route_id;
$$;
revoke all on function public.route_geometry(uuid) from public, anon, authenticated;
grant execute on function public.route_geometry(uuid) to authenticated;

-- 2. Everyone in a group counts from the same date.
--
-- Letting a joiner pick their own start meant tagging along with someone who
-- began months ago: the newcomer starts hopelessly behind and, under the leash
-- rule, immediately pins the leader in place. The group's own start date is the
-- only one that makes the race fair.
alter table public.journey_groups
  add column starts_on date not null default current_date;

comment on column public.journey_groups.starts_on is
  'Shared start date for every member. Tagging along means starting together, '
  'so members do not choose their own.';

create or replace function public.start_group_journey(
  p_route_id uuid, p_from date, p_mode text default 'tag_along',
  p_invitees uuid[] default '{}', p_max_gap_m double precision default 100000
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare g_id uuid; j_id uuid; invitee uuid; starts date;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (
    select 1 from public.routes r
    where r.id = p_route_id and (r.owner_id is null or r.owner_id = auth.uid())
  ) then raise exception 'Route not found'; end if;

  -- A group cannot start in the past: everyone runs the same stretch of time.
  starts := least(coalesce(p_from, current_date), current_date);

  insert into public.journey_groups (route_id, owner_id, mode, max_gap_m, starts_on)
  values (p_route_id, auth.uid(), p_mode, p_max_gap_m, starts) returning id into g_id;

  insert into public.journeys (user_id, route_id, start_offset_m, activities_from, group_id)
  values (auth.uid(), p_route_id, 0, starts, g_id) returning id into j_id;

  insert into public.journey_group_members (group_id, user_id, journey_id, status, invited_by)
  values (g_id, auth.uid(), j_id, 'joined', auth.uid());

  foreach invitee in array coalesce(p_invitees, '{}') loop
    if invitee <> auth.uid() and public.is_my_friend(invitee) then
      insert into public.journey_group_members (group_id, user_id, status, invited_by)
      values (g_id, invitee, 'invited', auth.uid())
      on conflict (group_id, user_id) do nothing;
    end if;
  end loop;

  return j_id;
end;
$$;
revoke all on function public.start_group_journey(uuid, date, text, uuid[], double precision)
  from public, anon, authenticated;
grant execute on function public.start_group_journey(uuid, date, text, uuid[], double precision)
  to authenticated;

-- Accepting no longer takes a date: the group already has one.
create or replace function public.respond_to_group_invite(
  p_group_id uuid, p_accept boolean, p_from date default null
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare r_id uuid; j_id uuid; starts date;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select g.route_id, g.starts_on into r_id, starts
  from public.journey_groups g
  join public.journey_group_members m
    on m.group_id = g.id and m.user_id = auth.uid() and m.status = 'invited'
  where g.id = p_group_id;

  if r_id is null then raise exception 'No pending invitation'; end if;

  if not p_accept then
    update public.journey_group_members set status = 'declined'
      where group_id = p_group_id and user_id = auth.uid();
    return null;
  end if;

  -- p_from is ignored on purpose; the group's shared start date wins.
  insert into public.journeys (user_id, route_id, start_offset_m, activities_from, group_id)
  values (auth.uid(), r_id, 0, starts, p_group_id) returning id into j_id;

  update public.journey_group_members set status = 'joined', journey_id = j_id
    where group_id = p_group_id and user_id = auth.uid();

  return j_id;
end;
$$;
revoke all on function public.respond_to_group_invite(uuid, boolean, date)
  from public, anon, authenticated;
grant execute on function public.respond_to_group_invite(uuid, boolean, date) to authenticated;

-- Existing group members should share the group's date too.
update public.journeys j
set activities_from = g.starts_on
from public.journey_groups g
where j.group_id = g.id and j.activities_from <> g.starts_on;
