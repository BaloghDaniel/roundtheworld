import { lazy, Suspense, useEffect, useState } from 'react'
import type { Journey, JourneySummary } from '../lib/journey'
import type { GroupInvite } from '../lib/social'

const JourneyMap = lazy(() => import('../components/JourneyMap'))
// ?mapcheck=ui renders the real journey screen with the same fixture, so the
// layout can be reviewed without a session or any Strava data.
const JourneyScreen = lazy(() => import('./Journey'))
// ?mapcheck=list does the same for the journeys list.
const JourneysScreen = lazy(() => import('./Journeys'))

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
    travelled_m: 201_000,
    total_distance_m: 64_381_407,
    remaining_m: 64_180_407,
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
  const mode = new URLSearchParams(window.location.search).get('mapcheck')
  const uiOnly = mode === 'ui'

  useEffect(() => {
    const t = setInterval(() => setReport(measure()), 500)
    return () => clearInterval(t)
  }, [])

  if (mode === 'list') {
    // ?empty=1 photographs the zero-journey state, which is the only screen
    // with no cards under the header.
    const empty = new URLSearchParams(window.location.search).has('empty')
    return (
      <Suspense fallback={null}>
        <JourneysScreen
          onOpen={() => {}}
          onNew={() => {}}
          onProfile={() => {}}
          preview={{
            journeys: empty ? [] : FAKE_LIST,
            profile: { id: 'me', display_name: 'Daniel', handle: 'daniel', avatar_url: null },
            invites: empty ? [] : FAKE_INVITES,
          }}
        />
      </Suspense>
    )
  }

  if (uiOnly) {
    return (
      <Suspense fallback={null}>
        <JourneyScreen journey={FAKE} onBack={() => {}} />
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
