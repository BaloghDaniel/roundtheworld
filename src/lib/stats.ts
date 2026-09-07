import type { JourneySummary } from './journey'
import { supabase } from './supabase'

export type WeekBucket = { start: string; m: number }

export type RecentActivity = {
  name: string
  sport_type: string
  distance_m: number
  start_date: string
}

export type Stats = {
  total_m: number
  activity_count: number
  week_m: number
  prev_week_m: number
  best_week_m: number
  day_streak: number
  weeks: WeekBucket[]
  recent: RecentActivity[]
  first_activity: string | null
}

export const EMPTY_STATS: Stats = {
  total_m: 0,
  activity_count: 0,
  week_m: 0,
  prev_week_m: 0,
  best_week_m: 0,
  day_streak: 0,
  weeks: [],
  recent: [],
  first_activity: null,
}

export async function fetchStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc('my_stats')
  if (error) throw error
  return { ...EMPTY_STATS, ...(data as Partial<Stats>) }
}

/* ------------------------------------------------------------------ badges */

export type Badge = {
  id: string
  name: string
  hint: string
  /** 0 to 1. Reaching 1 earns it. */
  progress: number
  earned: boolean
}

/**
 * Achievements are derived, never stored.
 *
 * Every one of these is a pure function of numbers the app already has, so
 * there is no table to keep in step and no way to hold a badge the underlying
 * distance no longer supports. It also means a badge appears the moment a sync
 * lands, without a job having to notice.
 */
export function badgesFor(stats: Stats, journeys: JourneySummary[]): Badge[] {
  const furthest = journeys.reduce(
    (best, j) => Math.max(best, j.travelled_m / j.total_distance_m),
    0,
  )
  const laps = journeys.reduce((n, j) => n + j.laps, 0)
  const goalsDone = journeys.filter((j) => j.completed && !j.is_loop).length

  const list: Omit<Badge, 'earned'>[] = [
    {
      id: 'first-100',
      name: 'First 100',
      hint: 'Cover 100 km',
      progress: stats.total_m / 100_000,
    },
    {
      id: 'marathon-week',
      name: 'Marathon',
      hint: '42.2 km in one week',
      progress: stats.best_week_m / 42_195,
    },
    {
      id: 'streak-ten',
      name: '10 days',
      hint: 'Log ten days running',
      progress: stats.day_streak / 10,
    },
    {
      id: 'halfway',
      name: 'Halfway',
      hint: 'Reach the midpoint of a journey',
      progress: furthest / 0.5,
    },
    {
      id: 'arrival',
      name: 'Arrival',
      hint: 'Finish a city-to-city goal',
      progress: goalsDone,
    },
    {
      id: 'lap',
      name: 'Full lap',
      hint: 'Complete a lap of the world',
      progress: laps,
    },
  ]

  return list.map((b) => ({
    ...b,
    progress: Math.max(0, Math.min(1, b.progress || 0)),
    earned: (b.progress || 0) >= 1,
  }))
}

/* ------------------------------------------------------------- formatting */

/** "12.4 km", or whole kilometres once the figure is long enough not to need
 *  the decimal. Distances are read at a glance, not audited. */
export const km = (m: number) =>
  m >= 100_000 ? Math.round(m / 1000).toLocaleString() : (m / 1000).toFixed(1)

export function relativeDay(iso: string): string {
  const then = new Date(iso)
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Strava's sport types are CamelCase enums; these are the ones we count. */
export function sportLabel(sport: string): string {
  return sport
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^Virtual /, '')
    .toLowerCase()
}
