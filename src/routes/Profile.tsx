import { useCallback, useEffect, useRef, useState } from 'react'
import AdminUsers from '../components/AdminUsers'
import Avatar from '../components/Avatar'
import { BadgeTile } from '../components/Badges'
import { useAuth } from '../lib/auth'
import { fetchJourneys, type JourneySummary } from '../lib/journey'
import { badgesFor, EMPTY_STATS, fetchStats, km, type Stats } from '../lib/stats'
import { useTheme, type ThemeChoice } from '../lib/theme'
import {
  amIAdmin,
  fetchFriends,
  fetchMyProfile,
  removeFriend,
  respondToFriendRequest,
  updateProfile,
  uploadAvatar,
  type Friend,
  type Profile as ProfileRow,
} from '../lib/social'

type Props = {
  onBack: () => void
  onFindFriends: () => void
  /** Fixture data for ?mapcheck=profile. Never set in the app itself. */
  preview?: {
    profile: ProfileRow
    friends: Friend[]
    stats: Stats
    journeys: JourneySummary[]
  }
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      className="card grid size-10 place-items-center text-ink transition hover:bg-raised"
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18 9 12l6-6" />
      </svg>
    </button>
  )
}

export default function Profile({ onBack, onFindFriends, preview }: Props) {
  const { user, signOut } = useAuth()
  const { choice, setChoice } = useTheme()
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [journeys, setJourneys] = useState<JourneySummary[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (preview) {
      setProfile(preview.profile)
      setName(preview.profile.display_name ?? '')
      setFriends(preview.friends)
      setStats(preview.stats)
      setJourneys(preview.journeys)
      return
    }
    try {
      const [p, f, admin, s, j] = await Promise.all([
        fetchMyProfile(),
        fetchFriends(),
        amIAdmin().catch(() => false),
        fetchStats().catch(() => EMPTY_STATS),
        fetchJourneys().catch(() => []),
      ])
      setProfile(p)
      setName(p?.display_name ?? '')
      setFriends(f)
      setIsAdmin(admin)
      setStats(s)
      setJourneys(j)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your profile')
    }
  }, [preview])

  useEffect(() => {
    void load()
  }, [load])

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('avatar')
    setError(null)
    try {
      const url = await uploadAvatar(file)
      setProfile((p) => (p ? { ...p, avatar_url: url } : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function saveName() {
    if (!name.trim() || name === profile?.display_name) return
    setBusy('name')
    try {
      await updateProfile({ display_name: name.trim() })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(null)
    }
  }

  const accepted = friends.filter((f) => f.status === 'accepted')
  const incoming = friends.filter((f) => f.status === 'pending' && f.direction === 'incoming')
  const outgoing = friends.filter((f) => f.status === 'pending' && f.direction === 'outgoing')
  const badges = badgesFor(stats, journeys)
  const earned = badges.filter((b) => b.earned).length

  return (
    <main className="screen mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 py-5">
      <header className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <h1 className="flex-1 font-bold tracking-tight text-ink">Profile</h1>
        <button
          type="button"
          onClick={() => void signOut()}
          className="btn-quiet px-3.5 py-2 text-xs"
        >
          Sign out
        </button>
      </header>

      {error && (
        <p role="alert" className="card px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="card-hero px-5 py-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy === 'avatar'}
            className="relative shrink-0 rounded-full transition hover:opacity-80 disabled:opacity-50"
            aria-label="Change avatar"
          >
            <Avatar name={profile?.display_name} url={profile?.avatar_url} size={68} />
            <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full bg-accent text-on-accent ring-2 ring-surface">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPickAvatar}
            className="hidden"
          />

          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void saveName()}
              placeholder="Your name"
              className="w-full rounded-xl bg-raised px-3 py-2 text-base font-bold tracking-tight text-ink outline-none transition focus:ring-2 focus:ring-accent"
            />
            <div className="truncate text-xs text-muted">
              @{profile?.handle ?? '…'}
              {user?.email && ` · ${user.email}`}
            </div>
            {busy === 'avatar' && <div className="text-xs text-muted">Uploading…</div>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-hair border-t border-hair pt-4">
          <div className="text-center">
            <div className="readout text-xl leading-none">{km(stats.total_m)}</div>
            <div className="eyebrow mt-1">km total</div>
          </div>
          <div className="text-center">
            <div className="readout text-xl leading-none">{stats.day_streak}</div>
            <div className="eyebrow mt-1">day streak</div>
          </div>
          <div className="text-center">
            <div className="readout text-xl leading-none">{accepted.length}</div>
            <div className="eyebrow mt-1">friends</div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="eyebrow">Achievements</h2>
          <span className="text-[11px] tabular-nums text-muted">
            {earned} of {badges.length} earned
          </span>
        </div>
        <div className="card px-4 py-4">
          <ul className="grid grid-cols-3 justify-items-center gap-y-5 sm:grid-cols-6">
            {badges.map((b) => (
              <BadgeTile key={b.id} badge={b} />
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="eyebrow">Friends</h2>
          <button
            type="button"
            onClick={onFindFriends}
            className="text-xs font-bold text-accent-ink underline underline-offset-2"
          >
            Find friends
          </button>
        </div>

        {incoming.length > 0 && (
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.friendship_id} className="card flex items-center gap-3 px-4 py-3">
                <Avatar name={f.display_name} url={f.avatar_url} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{f.display_name}</div>
                  <div className="text-xs text-muted">wants to be friends</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await respondToFriendRequest(f.friendship_id, true)
                    await load()
                  }}
                  className="btn-accent px-3.5 py-2 text-xs"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await respondToFriendRequest(f.friendship_id, false)
                    await load()
                  }}
                  className="text-xs text-muted transition hover:text-ink"
                >
                  Ignore
                </button>
              </li>
            ))}
          </ul>
        )}

        {accepted.length === 0 && incoming.length === 0 && outgoing.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-muted">
            No friends yet. Find someone to run with.
          </p>
        ) : (
          <ul className="space-y-2">
            {accepted.map((f) => (
              <li key={f.id} className="card flex items-center gap-3 px-4 py-3">
                <Avatar name={f.display_name} url={f.avatar_url} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{f.display_name}</div>
                  <div className="truncate text-xs text-muted">@{f.handle}</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await removeFriend(f.id)
                    await load()
                  }}
                  className="text-xs text-muted transition hover:text-danger"
                >
                  Remove
                </button>
              </li>
            ))}
            {outgoing.map((f) => (
              <li
                key={f.friendship_id}
                className="card flex items-center gap-3 px-4 py-3 opacity-60"
              >
                <Avatar name={f.display_name} url={f.avatar_url} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{f.display_name}</div>
                  <div className="text-xs text-muted">request sent</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="eyebrow px-1">Appearance</h2>
        <div className="card flex gap-1 p-1.5">
          {(['light', 'dark', 'system'] as ThemeChoice[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChoice(c)}
              aria-pressed={choice === c}
              className={`flex-1 rounded-full px-3 py-2.5 text-xs font-bold capitalize transition ${
                choice === c ? 'bg-accent text-on-accent' : 'text-muted hover:bg-raised'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {isAdmin && <AdminUsers />}
    </main>
  )
}
