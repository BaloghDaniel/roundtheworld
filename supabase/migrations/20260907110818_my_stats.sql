-- Everything the home screen needs to feel like a training log rather than a
-- list: one round trip instead of five, because this runs on every app open.
--
-- Dates are UTC days. Strava reports an activity's local start time, but the
-- streak only has to be self-consistent, and mixing zones would let one run
-- count for two days.

create or replace function public.my_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with acts as (
  select a.distance_m, a.sport_type, a.name, a.start_date,
         (a.start_date at time zone 'utc')::date as day
  from public.activities a
  where a.user_id = auth.uid()
),
days as (select distinct day from acts),
-- Consecutive days share a constant (day - row_number): the islands trick.
islands as (
  select day, day - (row_number() over (order by day))::int as grp from days
),
runs as (
  select count(*) as len, max(day) as last_day from islands group by grp
),
-- Eight weeks including this one, zero-filled, so the chart never has gaps.
span as (
  select generate_series(
    date_trunc('week', current_date) - interval '7 weeks',
    date_trunc('week', current_date),
    interval '1 week'
  ) as wk
),
weeks as (
  select s.wk::date as start, coalesce(sum(a.distance_m), 0) as m
  from span s
  left join acts a on date_trunc('week', a.day) = s.wk
  group by s.wk order by s.wk
)
select jsonb_build_object(
  'total_m', coalesce((select sum(distance_m) from acts), 0),
  'activity_count', (select count(*) from acts),
  'week_m', coalesce((select m from weeks
                      where start = date_trunc('week', current_date)::date), 0),
  'prev_week_m', coalesce((select m from weeks
                           where start = (date_trunc('week', current_date)
                                          - interval '1 week')::date), 0),
  -- All time, not just the eight shown: a personal best you cannot see is
  -- still a personal best.
  'best_week_m', coalesce((select max(s) from (
                            select sum(distance_m) s from acts
                            group by date_trunc('week', day)) t), 0),
  -- A streak survives today not having happened yet.
  'day_streak', coalesce((select len from runs
                          where last_day >= current_date - 1
                          order by len desc limit 1), 0),
  'weeks', coalesce((select jsonb_agg(jsonb_build_object('start', start, 'm', m)
                            order by start) from weeks), '[]'::jsonb),
  'recent', coalesce((select jsonb_agg(r) from (
                       select name, sport_type, distance_m, start_date
                       from acts order by start_date desc limit 5) r), '[]'::jsonb),
  'first_activity', (select min(start_date) from acts)
);
$$;

revoke all on function public.my_stats() from public, anon, authenticated;
grant execute on function public.my_stats() to authenticated;
