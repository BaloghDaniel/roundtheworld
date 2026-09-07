import { useState } from 'react'
import { beginStravaConnect } from '../lib/strava'

/** Shown wherever distance is displayed but nothing is feeding it — without a
 *  Strava connection every figure on the screen stays at zero, so this needs
 *  to explain that rather than just offer a button. */
export default function StravaBanner() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      await beginStravaConnect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach Strava')
      setBusy(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#FC4C02] text-white">
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
            <path d="M13.8 0 7.4 12.6h3.8L13.8 7.4l2.6 5.2h3.7L13.8 0Zm2.6 12.6-1.9 3.8-1.9-3.8h-2.9L14.5 21l4.8-8.4h-2.9Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight text-ink">
            Nothing is feeding your distance
          </p>
          <p className="mt-0.5 text-pretty text-xs leading-relaxed text-muted">
            Every figure here stays at zero until Strava is connected. We read
            only the distance, type and date of each activity — never your GPS
            tracks.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void connect()}
        disabled={busy}
        className="w-full bg-[#FC4C02] px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? 'Redirecting…' : 'Connect Strava'}
      </button>

      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
