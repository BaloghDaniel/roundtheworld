import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './lib/auth'
import { fetchJourney, type Journey } from './lib/journey'
import { connectOutcome, fetchStravaStatus, syncStrava, type StravaStatus } from './lib/strava'
import ConnectStrava from './routes/ConnectStrava'
import FindFriends from './routes/FindFriends'
import JourneyScreen from './routes/Journey'
import Home from './routes/Home'
import MapCheck from './routes/MapCheck'
import Onboarding from './routes/Onboarding'
import Profile from './routes/Profile'
import SignIn from './routes/SignIn'

function Spinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <span className="sr-only">Loading</span>
      <span
        aria-hidden
        className="size-6 animate-spin rounded-full border-2 border-hair border-t-accent"
      />
    </div>
  )
}

/** A message that outlives the screen it was raised on. */
function Toast({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <div
        role="status"
        className="glass pointer-events-auto flex max-w-md items-start gap-3 px-4 py-3"
      >
        <p className="flex-1 text-xs leading-relaxed text-ink">{text}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1 text-muted transition hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

type View =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'detail'; id: string }
  | { name: 'profile' }
  | { name: 'friends' }

const HOME: View = { name: 'home' }

export default function App() {
  const { user, loading } = useAuth()
  const [strava, setStrava] = useState<StravaStatus | null | undefined>(undefined)
  const [view, setView] = useState<View>(HOME)
  const [journey, setJourney] = useState<Journey | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [skippedConnect, setSkippedConnect] = useState(false)
  // Bumped whenever a sync writes new activities, so screens showing distance
  // reload without every one of them polling.
  const [dataVersion, setDataVersion] = useState(0)

  /* ---------------------------------------------------------- navigation */

  // Views live in history, so the browser's back button and Android's
  // hardware back move back a screen. Without this, back leaves the app
  // entirely from any screen, which for an installed PWA reads as a crash.
  useEffect(() => {
    window.history.replaceState({ view: HOME }, '')
    const onPop = (e: PopStateEvent) => setView((e.state?.view as View) ?? HOME)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((next: View, replace = false) => {
    const method = replace ? 'replaceState' : 'pushState'
    window.history[method]({ view: next }, '')
    setView(next)
  }, [])

  const back = useCallback(() => window.history.back(), [])

  /* -------------------------------------------------------------- strava */

  useEffect(() => {
    if (!user) {
      setStrava(undefined)
      return
    }
    fetchStravaStatus()
      .then(setStrava)
      .catch(() => setStrava(null))
  }, [user])

  // The outcome of a Strava connection is reported in the URL the callback
  // redirects to, and that lands on whatever screen the app opens on. Reading
  // it here rather than on one screen is why "that account is already
  // connected to someone else" now reaches the person it happened to.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('strava')) return
    setNotice(connectOutcome(params))
    window.history.replaceState({ view: HOME }, '', import.meta.env.BASE_URL)
  }, [])

  // Sync on open. Distance only arrives from Strava, so waiting for someone to
  // find a button meant the home screen's headline figures were stale until
  // they did. The Edge Function debounces to 15 minutes server-side, so an
  // eager open costs at most one request.
  const syncedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!user || !strava?.connected || syncedFor.current === user.id) return
    syncedFor.current = user.id
    let live = true
    setSyncing(true)
    syncStrava()
      .then((result) => {
        if (live && !result.skipped) setDataVersion((n) => n + 1)
      })
      .catch(() => {
        // A failed background sync is not worth interrupting anyone for; the
        // Sync button on a journey reports properly when asked directly.
      })
      .finally(() => {
        if (live) setSyncing(false)
      })
    return () => {
      live = false
    }
  }, [user, strava?.connected])

  /* ------------------------------------------------------------ journeys */

  const openJourney = useCallback(
    async (id: string, replace = false) => {
      setJourney(undefined)
      go({ name: 'detail', id }, replace)
      try {
        setJourney(await fetchJourney(id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load that journey')
        setJourney(null)
      }
    },
    [go],
  )

  // ?mapcheck renders real components against fixtures with no session, so the
  // deployed bundle can be reviewed and diagnosed without signing in.
  if (new URLSearchParams(window.location.search).has('mapcheck')) return <MapCheck />

  if (loading) return <Spinner />
  if (!user) return <SignIn />

  // An error with no way out is a dead end. Every one of these is worth
  // retrying, and going home always works.
  if (error) {
    return (
      <main className="screen grid min-h-dvh place-items-center px-6">
        <div className="card max-w-sm space-y-4 px-6 py-7 text-center">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null)
                if (view.name === 'detail') void openJourney(view.id, true)
              }}
              className="btn-accent"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                go(HOME, true)
              }}
              className="btn-quiet"
            >
              Back to journeys
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (strava === undefined) return <Spinner />

  const toast = notice && <Toast text={notice} onDismiss={() => setNotice(null)} />

  // Strava is asked for first, because a journey with no activity source
  // cannot move. But the application-wide athlete cap means some people
  // genuinely cannot connect, and a wall with no way past is a dead end -- so
  // the ask is skippable and Home carries the prompt instead.
  if (!strava?.connected && !skippedConnect && view.name === 'home') {
    return (
      <>
        {toast}
        <ConnectStrava
          onConnected={() => void fetchStravaStatus().then(setStrava)}
          onSkip={() => setSkippedConnect(true)}
        />
      </>
    )
  }

  let screen
  if (view.name === 'profile') {
    screen = <Profile onBack={back} onFindFriends={() => go({ name: 'friends' })} />
  } else if (view.name === 'friends') {
    screen = <FindFriends onBack={back} />
  } else if (view.name === 'new') {
    screen = (
      <Onboarding
        // Replaces the onboarding entry, so back from a new journey returns
        // home rather than to the form that created it.
        onStarted={(id) => (id ? void openJourney(id, true) : go(HOME, true))}
        onCancel={back}
        stravaConnected={!!strava?.connected}
      />
    )
  } else if (view.name === 'detail') {
    if (journey === undefined) screen = <Spinner />
    else if (journey === null) screen = <Spinner />
    else screen = <JourneyScreen journey={journey} onBack={back} strava={strava} />
  } else {
    screen = (
      <Home
        onOpen={(id) => void openJourney(id)}
        onNew={() => go({ name: 'new' })}
        onProfile={() => go({ name: 'profile' })}
        stravaConnected={!!strava?.connected}
        syncing={syncing}
        refreshKey={dataVersion}
      />
    )
  }

  return (
    <>
      {toast}
      {screen}
    </>
  )
}
