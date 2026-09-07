import { lazy, Suspense, useEffect, useState } from 'react'
import type { Journey, JourneySummary } from '../lib/journey'
import type { Friend, GroupInvite, Profile as ProfileRow } from '../lib/social'
import type { Stats } from '../lib/stats'

const JourneyMap = lazy(() => import('../components/JourneyMap'))

// Every screen worth reviewing has a preview here. Most of the app sits behind
// Google auth and a Strava connection, which cannot be driven headlessly, so a
// screen with no entry in this file is a screen nobody can look at before it
// ships. Add one before changing a screen, not after.
//
//   ?mapcheck           map diagnostics
//   ?mapcheck=home      the home screen      (&empty=1 for the first-run state)
//   ?mapcheck=ui        a journey
//   ?mapcheck=profile   the profile
//   ?mapcheck=signin    sign-in
//   ?mapcheck=connect   connect Strava
//   ?mapcheck=new       start a journey
//   ?mapcheck=friends   find friends
const JourneyScreen = lazy(() => import('./Journey'))
const HomeScreen = lazy(() => import('./Home'))
const ProfileScreen = lazy(() => import('./Profile'))
const SignInScreen = lazy(() => import('./SignIn'))
const ConnectScreen = lazy(() => import('./ConnectStrava'))
const OnboardingScreen = lazy(() => import('./Onboarding'))
const FriendsScreen = lazy(() => import('./FindFriends'))

// A journey with no database behind it, so this page renders the real map
// component, in the real bundle, without needing a session.
const FAKE: Journey = {
  journey_id: 'mapcheck',
  route_id: '00000000-0000-0000-0000-000000000000',
  route_slug: 'world',
  route_name: 'Around the World',
  is_loop: true,
  completed: false,
  origin_name: null,
  destination_name: null,
  group_id: null,
  group_mode: null,
  max_gap_m: null,
  remaining_m: 64_180_407,
  pace_m_per_day: 815,
  eta: null,
  activities_from: '2026-01-01',
  travelled_m: 201_000,
  total_distance_m: 64_381_407,
  start_offset_m: 15_000,
  laps: 0,
  route_offset_m: 216_000,
  position: { lon: 15.3526, lat: 58.3798 },
  segment: { mode: 'road', reason: null },
  passed: { name: 'Stockholm', country: 'Sweden', behind_m: 216_000 },
  next: { name: 'Copenhagen', country: 'Denmark', ahead_m: 441_000 },
}

const FAKE_LIST: JourneySummary[] = [
  {
    journey_id: 'a',
    route_id: '00000000-0000-0000-0000-000000000000',
    route_slug: 'world',
    route_name: 'Around the World',
    is_loop: true,
    completed: false,
    origin_name: null,
    destination_name: null,
    activities_from: '2026-01-01',
    travelled_m: 201_365,
    total_distance_m: 64_381_407,
    remaining_m: 64_180_042,
    laps: 0,
    created_at: '2026-01-01T00:00:00Z',
    group_id: null,
    group_mode: null,
    party_size: 1,
  },
  {
    journey_id: 'b',
    route_id: '00000000-0000-0000-0000-000000000001',
    route_slug: 'sthlm-madrid',
    route_name: 'Stockholm → Madrid',
    is_loop: false,
    completed: false,
    origin_name: 'Stockholm',
    destination_name: 'Madrid',
    activities_from: '2026-06-01',
    travelled_m: 1_480_000,
    total_distance_m: 3_310_000,
    remaining_m: 1_830_000,
    laps: 0,
    created_at: '2026-06-01T00:00:00Z',
    group_id: 'g',
    group_mode: 'tag_along',
    party_size: 2,
  },
]

const FAKE_INVITES: GroupInvite[] = [
  {
    group_id: 'g2',
    mode: 'tag_along',
    max_gap_m: 100_000,
    route_name: 'Malmö → Berlin',
    origin_name: 'Malmö',
    destination_name: 'Berlin',
    total_distance_m: 640_000,
    is_loop: false,
    invited_by_name: 'Madicken',
    invited_by_avatar: null,
  },
]

const FAKE_PROFILE: ProfileRow = {
  id: 'me',
  display_name: 'Daniel Balogh',
  handle: 'daniel',
  avatar_url: null,
}

const FAKE_FRIENDS: Friend[] = [
  {
    id: 'f1',
    display_name: 'Madicken',
    handle: 'madicken',
    avatar_url: null,
    friendship_id: 'x',
    status: 'accepted',
    direction: 'outgoing',
  },
  {
    id: 'f2',
    display_name: 'Jonas Ek',
    handle: 'jonas',
    avatar_url: null,
    friendship_id: 'y',
    status: 'pending',
    direction: 'incoming',
  },
]

const WEEK_MS = 604_800_000
/** The Monday `offset` weeks back, so the fixture chart is always current. */
const monday = (offset: number) => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return new Date(d.getTime() - offset * WEEK_MS).toISOString().slice(0, 10)
}

const FAKE_STATS: Stats = {
  total_m: 201_365,
  activity_count: 37,
  week_m: 18_400,
  prev_week_m: 13_590,
  best_week_m: 28_755,
  day_streak: 4,
  weeks: [
    { start: monday(7), m: 13_590 },
    { start: monday(6), m: 19_436 },
    { start: monday(5), m: 23_861 },
    { start: monday(4), m: 28_755 },
    { start: monday(3), m: 21_550 },
    { start: monday(2), m: 8_114 },
    { start: monday(1), m: 13_590 },
    { start: monday(0), m: 18_400 },
  ],
  recent: [
    {
      name: 'Morning run',
      sport_type: 'Run',
      distance_m: 8_240,
      start_date: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      name: 'Lunch ride',
      sport_type: 'Ride',
      distance_m: 24_600,
      start_date: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    },
    {
      name: 'Hills, again',
      sport_type: 'TrailRun',
      distance_m: 12_050,
      start_date: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    },
  ],
  first_activity: '2026-05-31T12:06:00+00:00',
}

const BLANK_STATS: Stats = {
  total_m: 0,
  activity_count: 0,
  week_m: 0,
  prev_week_m: 0,
  best_week_m: 0,
  day_streak: 0,
  weeks: FAKE_STATS.weeks.map((w) => ({ ...w, m: 0 })),
  recent: [],
  first_activity: null,
}

function measure() {
  const rows: string[] = []
  const box = (label: string, el: Element | null) =>
    rows.push(
      el
        ? `${label}: ${Math.round(el.getBoundingClientRect().width)} x ${Math.round(el.getBoundingClientRect().height)}`
        : `${label}: MISSING`,
    )

  box('outer (min-h-[55dvh] flex-1)', document.querySelector('[data-mapbox]'))
  box('map container', document.querySelector('[data-mapbox] > div'))
  box('.maplibregl-map', document.querySelector('.maplibregl-map'))
  box('.maplibregl-canvas-container', document.querySelector('.maplibregl-canvas-container'))

  const canvas = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement | null
  rows.push(
    canvas
      ? `canvas attr: ${canvas.width} x ${canvas.height} | css: ${canvas.style.width} x ${canvas.style.height}`
      : 'canvas: MISSING',
  )

  // Is MapLibre's own stylesheet actually applied? A lazily loaded chunk pulls
  // its CSS in at runtime, and if that fails the map has no layout rules.
  let maplibreRules = 0
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if ((rule as CSSStyleRule).selectorText?.includes('maplibregl')) maplibreRules++
      }
    } catch {
      rows.push('(a stylesheet was cross-origin and could not be read)')
    }
  }
  rows.push(`maplibre CSS rules found: ${maplibreRules}`)
  rows.push(`webgl2: ${!!document.createElement('canvas').getContext('webgl2')}`)

  return rows.join('\n')
}

export default function MapCheck() {
  const [report, setReport] = useState('measuring…')
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mapcheck')
  const empty = params.has('empty')

  useEffect(() => {
    const t = setInterval(() => setReport(measure()), 500)
    return () => clearInterval(t)
  }, [])

  const noop = () => {}

  if (mode) {
    return (
      <Suspense fallback={null}>
        {mode === 'home' && (
          <HomeScreen
            onOpen={noop}
            onNew={noop}
            onProfile={noop}
            preview={{
              journeys: empty ? [] : FAKE_LIST,
              profile: FAKE_PROFILE,
              invites: empty ? [] : FAKE_INVITES,
              stats: empty ? BLANK_STATS : FAKE_STATS,
            }}
          />
        )}
        {mode === 'ui' && <JourneyScreen journey={FAKE} onBack={noop} />}
        {mode === 'profile' && (
          <ProfileScreen
            onBack={noop}
            onFindFriends={noop}
            preview={{
              profile: FAKE_PROFILE,
              friends: FAKE_FRIENDS,
              stats: FAKE_STATS,
              journeys: FAKE_LIST,
              strava: {
                connected: true,
                athlete_id: 12345678,
                last_sync_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
              },
            }}
          />
        )}
        {mode === 'signin' && <SignInScreen />}
        {mode === 'connect' && <ConnectScreen onConnected={noop} onSkip={noop} />}
        {mode === 'new' && <OnboardingScreen onStarted={noop} onCancel={noop} />}
        {mode === 'friends' && <FriendsScreen onBack={noop} />}
      </Suspense>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="px-4 py-3 text-sm font-semibold text-ink">
        Map diagnostic
      </header>

      <div data-mapbox className="relative min-h-[55dvh] flex-1 overflow-hidden">
        <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-raised" />}>
          <JourneyMap journey={FAKE} />
        </Suspense>
      </div>

      <pre className="max-h-[35dvh] overflow-auto border-t border-hair bg-black px-3 py-2 text-[11px] leading-relaxed text-green-400">
        {report}
      </pre>
    </main>
  )
}
