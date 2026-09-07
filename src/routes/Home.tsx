import { useCallback, useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import Badges from '../components/Badges'
import StravaBanner from '../components/StravaBanner'
import WeekChart, { weekSpan } from '../components/WeekChart'
import { deleteJourney, fetchJourneys, type JourneySummary } from '../lib/journey'
import {
  badgesFor,
  EMPTY_STATS,
  fetchStats,
  km,
  relativeDay,
  sportLabel,
  type Stats,
} from '../lib/stats'
import {
  fetchGroupInvites,
  fetchMyProfile,
  respondToGroupInvite,
  type GroupInvite,
  type Profile,
} from '../lib/social'

type Props = {
  onOpen: (id: string) => void
  onNew: () => void
  onProfile: () => void
  /** Whether there is anything feeding the numbers below. */
  stravaConnected?: boolean
  /** A sync is running; the figures may be about to change. */
  syncing?: boolean
  /** Bumped by the app when a sync lands, to reload without polling. */
  refreshKey?: number
  /** Fixture data for ?mapcheck=home, so the screen can be photographed
   *  without a session. Never set in the app itself. */
  preview?: {
    journeys: JourneySummary[]
    profile: Profile | null
    invites: GroupInvite[]
    stats: Stats
  }
}

const MODE_LABEL: Record<GroupInvite['mode'], string> = {
  tag_along: 'Tag along',
  race: 'Race',
  scramble: 'Scramble',
}

/* ------------------------------------------------------------------ pieces */

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 px-1 text-center">
      <div className="readout text-xl leading-none">
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-bold text-muted">{unit}</span>}
      </div>
      <div className="eyebrow mt-1 truncate">{label}</div>
    </div>
  )
}

function JourneyCard({
  journey,
  onOpen,
  onDelete,
  deleting,
  confirming,
}: {
  journey: JourneySummary
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
  confirming: boolean
}) {
  const pct = Math.min(100, (journey.travelled_m / journey.total_distance_m) * 100)
  const title = journey.is_loop
    ? journey.route_name
    : `${journey.origin_name} → ${journey.destination_name}`

  return (
    <li className="card overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full px-4 pt-4 text-left transition hover:bg-raised"
      >
        <div className="flex items-center gap-1.5">
          <span className="chip bg-raised text-muted">
            {journey.is_loop ? 'Circumnavigation' : 'Goal'}
          </span>
          {journey.laps > 0 && (
            <span className="chip bg-accent text-on-accent">Lap {journey.laps + 1}</span>
          )}
          {journey.party_size > 1 && (
            <span className="chip bg-raised text-muted">
              Tag along · {journey.party_size}
            </span>
          )}
          {journey.completed && (
            <span className="chip bg-accent text-on-accent">Done</span>
          )}
        </div>

        <div className="mt-1 truncate text-[1.35rem] font-extrabold leading-tight tracking-tight text-ink">
          {title}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="readout text-3xl leading-none">
            {km(journey.travelled_m)}
            <span className="ml-1 text-xs font-bold text-muted">km</span>
          </div>
          <div className="readout text-lg leading-none text-accent-ink">
            {pct.toFixed(1)}%
          </div>
        </div>

        <div
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-ahead/25"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2 text-xs text-muted">
          {journey.completed
            ? `${km(journey.total_distance_m)} km, all of it`
            : `${km(journey.remaining_m)} km still to go`}
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-hair px-4 py-2.5">
        <span className="text-[11px] leading-snug text-muted">
          {confirming
            ? 'Your activities are untouched — only this journey goes.'
            : `Counting from ${new Date(journey.activities_from).toLocaleDateString()}`}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className={`text-[11px] font-semibold transition disabled:opacity-50 ${
            confirming ? 'text-danger' : 'text-muted hover:text-ink'
          }`}
        >
          {deleting ? 'Deleting…' : confirming ? 'Tap again to delete' : 'Delete'}
        </button>
      </div>
    </li>
  )
}

/* -------------------------------------------------------------------- screen */

export default function Home({
  onOpen,
  onNew,
  onProfile,
  preview,
  stravaConnected = true,
  syncing = false,
  refreshKey = 0,
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [invites, setInvites] = useState<GroupInvite[]>([])
  const [journeys, setJourneys] = useState<JourneySummary[] | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (preview) {
      setJourneys(preview.journeys)
      setProfile(preview.profile)
      setInvites(preview.invites)
      setStats(preview.stats)
      return
    }
    try {
      const [list, me, pending, s] = await Promise.all([
        fetchJourneys(),
        fetchMyProfile(),
        fetchGroupInvites(),
        // Stats are decoration: a failure here must not blank the journeys.
        fetchStats().catch(() => EMPTY_STATS),
      ])
      setJourneys(list)
      setProfile(me)
      setInvites(pending)
      setStats(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your journeys')
      setJourneys([])
    }
  }, [preview])

  useEffect(() => {
    void load()
    // refreshKey changes when a background sync writes new activities.
  }, [load, refreshKey])

  async function remove(id: string) {
    setBusy(id)
    setError(null)
    try {
      await deleteJourney(id)
      setConfirming(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that journey')
    } finally {
      setBusy(null)
    }
  }

  const delta = stats.week_m - stats.prev_week_m
  const badges = badgesFor(stats, journeys ?? [])

  return (
    <main className="screen mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-5">
      <header className="flex items-center gap-3">
        <img
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          alt=""
          className="size-9 rounded-xl"
          width={36}
          height={36}
        />
        <div className="min-w-0 flex-1 truncate text-[0.95rem] font-bold tracking-tight text-ink">
          {profile?.display_name ?? 'Your journeys'}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-on-accent transition active:scale-[0.98] hover:brightness-105"
        >
          <svg viewBox="0 0 24 24" className="-ml-0.5 size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          New
        </button>
        <button
          type="button"
          onClick={onProfile}
          aria-label="Your profile"
          className="shrink-0 rounded-full ring-1 ring-hair transition hover:ring-accent"
        >
          <Avatar name={profile?.display_name} url={profile?.avatar_url} size={36} />
        </button>
      </header>

      {error && (
        <p role="alert" className="card mt-4 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!stravaConnected && (
        <div className="mt-5">
          <StravaBanner />
        </div>
      )}

      {/* The week is the habit, so it gets the loudest panel on the screen. */}
      <section className="card-accent mt-5 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-on-accent/60">
              This week
              {syncing && (
                <>
                  <span
                    aria-hidden
                    className="size-2.5 animate-spin rounded-full border-[1.5px] border-on-accent/30 border-t-on-accent/80"
                  />
                  <span className="sr-only">Syncing with Strava</span>
                </>
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 font-extrabold tabular-nums tracking-tighter text-on-accent">
              <span className="count-in text-5xl leading-none">{km(stats.week_m)}</span>
              <span className="text-lg">km</span>
            </div>
          </div>
          {stats.day_streak > 0 && (
            <div className="rounded-full bg-on-accent/10 px-3 py-1.5 text-center">
              <div className="text-lg font-extrabold leading-none tabular-nums text-on-accent">
                {stats.day_streak}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-on-accent/60">
                day streak
              </div>
            </div>
          )}
        </div>

        <p className="mt-1 text-xs font-medium text-on-accent/70">
          {stats.activity_count === 0
            ? 'Nothing logged yet — your first activity lands here.'
            : stats.week_m === 0
              ? 'Nothing this week yet. Last week you ran ' +
                km(stats.prev_week_m) +
                ' km.'
              : delta === 0
                ? 'Level with last week.'
                : delta > 0
                  ? `${km(delta)} km up on last week.`
                  : `${km(-delta)} km down on last week.`}
        </p>

        <div className="mt-4 text-on-accent">
          <WeekChart weeks={stats.weeks} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-on-accent/50">
          <span>{weekSpan(stats.weeks)}</span>
          <span>8 weeks</span>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-3 divide-x divide-hair">
        <Stat label="Total" value={km(stats.total_m)} unit="km" />
        <Stat label="Best week" value={km(stats.best_week_m)} unit="km" />
        <Stat label="Activities" value={String(stats.activity_count)} />
      </section>

      {invites.length > 0 && (
        <section className="mt-8 space-y-2.5">
          <h2 className="eyebrow px-1">Invitations</h2>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.group_id} className="card px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={invite.invited_by_name} url={invite.invited_by_avatar} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {invite.invited_by_name} invited you
                    </div>
                    <div className="truncate text-xs text-muted">
                      {MODE_LABEL[invite.mode]} · {invite.route_name} ·{' '}
                      {km(invite.total_distance_m)} km
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const id = await respondToGroupInvite(invite.group_id, true)
                      await load()
                      if (id) onOpen(id)
                    }}
                    className="btn-accent flex-1 px-3 py-2.5 text-xs"
                  >
                    Tag along
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await respondToGroupInvite(invite.group_id, false)
                      await load()
                    }}
                    className="btn-quiet px-4 py-2.5 text-xs"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 space-y-2.5">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="eyebrow">Journeys</h2>
          {journeys && journeys.length > 0 && (
            <span className="text-[11px] tabular-nums text-muted">{journeys.length} active</span>
          )}
        </div>

        {journeys === null ? (
          <div className="card h-32 animate-pulse" />
        ) : journeys.length === 0 ? (
          <div className="card space-y-4 px-5 py-8 text-center">
            <p className="text-lg font-extrabold tracking-tight text-ink">
              Pick somewhere to run to
            </p>
            <p className="text-pretty text-sm leading-relaxed text-muted">
              A city across the continent, or the whole way around the world.
              Every kilometre you log moves you down the road.
            </p>
            <button type="button" onClick={onNew} className="btn-accent">
              Start a journey
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {journeys.map((j) => (
              <JourneyCard
                key={j.journey_id}
                journey={j}
                onOpen={() => onOpen(j.journey_id)}
                deleting={busy === j.journey_id}
                confirming={confirming === j.journey_id}
                onDelete={() =>
                  confirming === j.journey_id
                    ? void remove(j.journey_id)
                    : setConfirming(j.journey_id)
                }
              />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <Badges badges={badges} />
      </div>

      {stats.recent.length > 0 && (
        <section className="mt-8 space-y-2.5 pb-2">
          <h2 className="eyebrow px-1">Recent activity</h2>
          <ul className="divide-y divide-hair border-y border-hair">
            {stats.recent.map((a) => (
              <li key={a.start_date} className="flex items-center gap-3 px-1 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-accent-ink">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M13 4a1 1 0 1 0 0-.001M7 21l3-6 4-2 2 4 3 1M6 12l2-4 4-1 3 3" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{a.name}</div>
                  <div className="truncate text-[11px] text-muted">
                    {sportLabel(a.sport_type)} · {relativeDay(a.start_date)}
                  </div>
                </div>
                <span className="readout shrink-0 text-sm">
                  {km(a.distance_m)}
                  <span className="ml-0.5 text-[10px] font-bold text-muted">km</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
