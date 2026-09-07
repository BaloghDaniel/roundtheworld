import { useState } from 'react'
import { useAuth } from '../lib/auth'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.63l4.01 3.09C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  )
}

const POINTS = [
  ['64 381 km', 'the full road route around the world'],
  ['Any distance counts', 'a lap of the park moves you down the road'],
  ['Run it with friends', 'tag along and nobody gets left behind'],
]

export default function SignIn() {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      // On success the browser navigates to Google, so nothing follows here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sign-in.')
      setBusy(false)
    }
  }

  return (
    <main className="screen mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-9 px-6 py-14">
      <div className="space-y-6">
        <img
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          alt=""
          className="size-14 rounded-2xl"
          width={56}
          height={56}
        />
        {/* The lime is a fill, not a text colour: as a highlight it carries the
            same punch in both themes, where a lime word would vanish on the
            pale one. */}
        <h1 className="text-[2.75rem] font-extrabold leading-[0.94] tracking-tighter text-ink">
          Run the
          <br />
          <span className="mt-1 inline-block rounded-xl bg-accent px-2.5 pb-1 text-on-accent">
            whole world
          </span>
        </h1>
        <p className="max-w-[22rem] text-pretty text-[0.95rem] leading-relaxed text-muted">
          Every run and ride you log, laid end to end along real roads. Watch
          yourself cross continents one activity at a time.
        </p>
      </div>

      <ul className="space-y-3">
        {POINTS.map(([head, tail]) => (
          <li key={head} className="flex items-start gap-3">
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <p className="text-sm leading-snug text-muted">
              <span className="font-bold text-ink">{head}</span> — {tail}
            </p>
          </li>
        ))}
      </ul>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-4 py-3.5 text-sm font-bold text-zinc-900 shadow-sm ring-1 ring-hair transition active:scale-[0.98] hover:bg-zinc-100 disabled:opacity-60"
        >
          <GoogleMark />
          {busy ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}

        <p className="text-center text-xs leading-relaxed text-muted">
          You'll connect Strava after signing in. We only read the distance,
          type and date of each activity — never your GPS tracks.
        </p>
      </div>
    </main>
  )
}
