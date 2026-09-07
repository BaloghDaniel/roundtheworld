import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { beginStravaConnect } from '../lib/strava'

/**
 * Shown before any journey exists.
 *
 * A journey with no activity source cannot move, so connecting Strava is the
 * first thing asked for rather than something to discover later.
 */
export default function ConnectStrava({ onConnected }: { onConnected: () => void }) {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      await beginStravaConnect()
      // Success navigates to Strava, so nothing follows here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach Strava')
      setBusy(false)
    }
  }

  return (
    <main className="screen mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-14">
      <div className="space-y-5">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#FC4C02] text-white">
          <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
            <path d="M13.8 0 7.4 12.6h3.8L13.8 7.4l2.6 5.2h3.7L13.8 0Zm2.6 12.6-1.9 3.8-1.9-3.8h-2.9L14.5 21l4.8-8.4h-2.9Z" />
          </svg>
        </span>

        <div className="space-y-3">
          <h1 className="text-[2rem] font-extrabold leading-tight tracking-tighter text-ink">
            Connect Strava
          </h1>
          <p className="text-pretty text-[0.95rem] leading-relaxed text-muted">
            Your runs and rides are what move you along a route. We read only
            the distance, type and date of each activity — never your GPS
            tracks.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="w-full rounded-full bg-[#FC4C02] px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white transition active:scale-[0.98] hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Redirecting…' : 'Connect Strava'}
        </button>

        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-center gap-5 text-xs text-muted">
          <button
            type="button"
            onClick={onConnected}
            className="underline underline-offset-4 transition hover:text-ink"
          >
            I've connected it
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="underline underline-offset-4 transition hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
