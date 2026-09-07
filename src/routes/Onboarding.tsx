import { useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import PlaceSearch from '../components/PlaceSearch'
import { createGoalRoute, placeFromCoords, startRouteJourney, type Place } from '../lib/goals'
import { currentPosition, startJourney } from '../lib/journey'
import { fetchFriends, startGroupJourney, type Friend } from '../lib/social'

type Props = {
  onStarted: (journeyId?: string) => void
  onCancel?: () => void
  /** A journey with nothing feeding it will sit at zero, which is worth
   *  saying before someone starts one rather than after. */
  stravaConnected?: boolean
}
type Kind = 'world' | 'goal'

const today = new Date().toISOString().slice(0, 10)

const KINDS: { id: Kind; title: string; hint: string; icon: string }[] = [
  {
    id: 'world',
    title: 'Around the world',
    hint: '64 381 km · a loop',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2c2.7 3 4 6.3 4 10s-1.3 7-4 10c-2.7-3-4-6.3-4-10s1.3-7 4-10Z',
  },
  {
    id: 'goal',
    title: 'City to city',
    hint: 'Pick a destination',
    icon: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  },
]

export default function Onboarding({ onStarted, onCancel, stravaConnected = true }: Props) {
  const [kind, setKind] = useState<Kind | null>(null)
  // Today by default: a new goal starts from now, not from history.
  const [from, setFrom] = useState(today)
  const [origin, setOrigin] = useState<Place | null>(null)
  const [goal, setGoal] = useState<Place | null>(null)
  const [here, setHere] = useState<{ lon: number; lat: number } | null>(null)
  const [locating, setLocating] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [invited, setInvited] = useState<Set<string>>(new Set())

  // The starting point defaults to where the user actually is. Refusing the
  // permission is fine: the world route then begins at its own origin, and a
  // goal route simply needs a start to be chosen by hand.
  useEffect(() => {
    let active = true
    currentPosition().then((p) => {
      if (!active) return
      setHere(p)
      setLocating(false)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    fetchFriends()
      .then((all) => setFriends(all.filter((f) => f.status === 'accepted')))
      .catch(() => setFriends([]))
  }, [])

  const startPlace = origin ?? (here ? placeFromCoords(here.lon, here.lat) : null)

  async function begin() {
    setError(null)
    try {
      let journeyId: string
      if (kind === 'world') {
        setBusy('Starting…')
        journeyId = await startJourney({ from, lon: startPlace?.lon, lat: startPlace?.lat })
      } else {
        if (!startPlace) throw new Error('Choose where you are starting from')
        if (!goal) throw new Error('Choose where you are heading')
        setBusy('Finding a road route…')
        const route = await createGoalRoute(startPlace, goal)
        setBusy('Starting…')
        journeyId =
          invited.size > 0
            ? await startGroupJourney({
                routeId: route.route_id,
                from,
                mode: 'tag_along',
                invitees: [...invited],
              })
            : await startRouteJourney(route.route_id, from)
      }
      onStarted(journeyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start your journey')
      setBusy(null)
    }
  }

  const ready = !!kind && !busy && !locating && (kind === 'world' || (!!goal && !!startPlace))

  return (
    <main className="screen mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8">
      <div className="space-y-2.5">
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tighter text-ink">
          {onCancel ? 'Start a new journey' : 'Where are you going?'}
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted">
          Your runs and rides are laid end to end along real roads. You never
          have to run the route itself — the distance is what counts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {KINDS.map((k) => {
          const on = kind === k.id
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              aria-pressed={on}
              className={`rounded-3xl border p-4 text-left transition active:scale-[0.99] ${
                on
                  ? 'border-accent bg-accent/15'
                  : 'border-hair bg-surface hover:border-muted'
              }`}
            >
              <span
                className={`mb-3 grid size-9 place-items-center rounded-full ${
                  on ? 'bg-accent text-on-accent' : 'bg-raised text-muted'
                }`}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={k.icon} />
                </svg>
              </span>
              <div className="text-sm font-bold tracking-tight text-ink">{k.title}</div>
              <div className="mt-0.5 text-[11px] text-muted">{k.hint}</div>
            </button>
          )
        })}
      </div>

      {kind && (
        <PlaceSearch
          label="Starting from"
          value={origin}
          onChange={setOrigin}
          placeholder="Search for a place"
          emptyHint={
            locating
              ? 'Finding your location…'
              : here
                ? `Using your current position (${here.lat.toFixed(2)}, ${here.lon.toFixed(2)}). Search to pick somewhere else.`
                : 'Location unavailable — search for your starting point.'
          }
        />
      )}

      {kind === 'goal' && (
        <PlaceSearch
          label="Heading for"
          value={goal}
          onChange={setGoal}
          placeholder="Madrid, Rome, Berlin…"
        />
      )}

      {/* A group counts from its own start date, so once anyone is invited
          there is no date left to choose. */}
      {kind && invited.size === 0 && (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink">Count activities from</span>
          <input
            type="date"
            value={from}
            max={today}
            onChange={(e) => setFrom(e.target.value)}
            className="field"
          />
          <span className="block text-xs leading-relaxed text-muted">
            Everything you logged on or after this date counts. Backdate it to
            bring in runs you have already done.
          </span>
        </label>
      )}

      {kind === 'goal' && friends.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-sm font-semibold text-ink">Tag along</span>
          <ul className="space-y-2">
            {friends.map((f) => {
              const on = invited.has(f.id)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setInvited((prev) => {
                        const next = new Set(prev)
                        if (on) next.delete(f.id)
                        else next.add(f.id)
                        return next
                      })
                    }
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                      on ? 'border-accent bg-accent/15' : 'border-hair bg-surface hover:bg-raised'
                    }`}
                  >
                    <Avatar name={f.display_name} url={f.avatar_url} size={34} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {f.display_name}
                    </span>
                    <span
                      className={`chip ${on ? 'bg-accent text-on-accent' : 'bg-raised text-muted'}`}
                    >
                      {on ? 'Invited' : 'Invite'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-xs leading-relaxed text-muted">
            You each run the whole distance, counting from today so nobody
            starts ahead. If one of you falls more than 100 km behind, the
            runner in front waits until the party closes up.
          </p>
        </div>
      )}

      {kind === 'world' && (
        <p className="text-xs leading-relaxed text-muted">
          The world route is a loop, so your starting point rotates it. You will
          be placed at the nearest point on the road.
        </p>
      )}

      {!stravaConnected && (
        <p className="rounded-2xl bg-raised px-4 py-3 text-xs leading-relaxed text-muted">
          Strava is not connected, so this journey will start at 0 km and stay
          there until it is. You can connect at any time — nothing is lost.
        </p>
      )}

      {error && (
        <p role="alert" className="card px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-3 pt-1">
        {kind === 'goal' && goal && startPlace && !busy && (
          <p className="text-center text-xs font-semibold text-muted">
            {startPlace.name} → {goal.name}
          </p>
        )}

        <button
          type="button"
          onClick={() => void begin()}
          disabled={!ready}
          className="btn-accent w-full py-3.5"
        >
          {busy ?? (kind ? 'Begin' : 'Choose a journey')}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="block w-full text-center text-xs text-muted underline underline-offset-4 transition hover:text-ink"
          >
            Keep my current journeys
          </button>
        )}
      </div>
    </main>
  )
}
