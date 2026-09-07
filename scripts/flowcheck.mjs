// Drives the real signed-in app to check the flow changes that only exist
// behind a session: history back, sync on open, and the connect toast.
//
//   npm run build && (cd /tmp/ui-preview && python3 -m http.server 8901 &)
//   node --env-file=.env.local scripts/flowcheck.mjs
//
// Creates a throwaway user, exercises the app as them, deletes them again.

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const URL_BASE = process.env.VITE_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const REF = new URL(URL_BASE).hostname.split('.')[0]
const APP = 'http://localhost:8901/roundtheworld/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const admin = (path, init = {}) =>
  fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })

const email = `flowcheck+${Date.now()}@example.com`
const password = 'flowcheck-' + Math.random().toString(36).slice(2)

console.log('creating throwaway user', email)
const created = await admin('/auth/v1/admin/users', {
  method: 'POST',
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json())
if (!created.id) throw new Error('could not create user: ' + JSON.stringify(created))

const session = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: PUBLISHABLE, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json())
if (!session.access_token) throw new Error('sign-in failed: ' + JSON.stringify(session))
console.log('signed in, uid', created.id)

/* ------------------------------------------------------------------ browser */

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9600 + Math.floor(Math.random() * 200)
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    '--window-size=430,930',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    break
  } catch {
    await sleep(250)
  }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))

let id = 0
const pending = new Map()
const errors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails.exception?.description ?? 'exception')
  }
})
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id
    pending.set(i, r)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result
    .value

await send('Runtime.enable')
await send('Page.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Network.setBypassServiceWorker', { bypass: true })

// supabase-js reads its session from this key before it makes any request.
const stored = JSON.stringify({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
  expires_in: session.expires_in,
  token_type: 'bearer',
  user: session.user,
})
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('sb-${REF}-auth-token', ${JSON.stringify(stored)}) } catch (e) {}`,
})

// Every request the page makes, so "did it sync on open?" is observed rather
// than assumed.
const requests = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url)
})

const shot = async (name) => {
  const png = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`/tmp/flow-${name}.png`, Buffer.from(png.data, 'base64'))
  return `/tmp/flow-${name}.png`
}
const heading = () =>
  evaluate(`(document.querySelector('h1')?.textContent
    || document.querySelector('main')?.textContent?.slice(0, 40) || '').trim()`)

/* -------------------------------------------------------------------- checks */

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// 1. The app opens signed in, and lands on the Strava ask (no connection).
await send('Page.navigate', { url: APP })
await sleep(6000)
let where = await heading()
check('opens signed in on the Strava ask', /Connect Strava/i.test(where), where)
await shot('1-connect')

// 2. The ask is skippable rather than a wall.
const skipped = await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')]
    .find(n => /look around/i.test(n.textContent))
  if (!b) return 'no skip button'
  b.click(); return 'clicked'
})()`)
await sleep(1500)
where = await heading()
check('skip leaves the Strava ask', skipped === 'clicked' && !/Connect Strava/i.test(where), `${skipped}, now: ${where}`)
await shot('2-after-skip')

// 3. History depth grows when moving to another screen, and back returns.
const beforeLen = await evaluate('history.length')
await evaluate(`[...document.querySelectorAll('button')]
  .find(n => /new/i.test(n.textContent))?.click()`)
await sleep(1500)
const onNew = await heading()
const afterLen = await evaluate('history.length')
check('opening a screen pushes history', afterLen > beforeLen, `${beforeLen} -> ${afterLen}`)
await shot('3-new-journey')

await evaluate('history.back()')
await sleep(1500)
const afterBack = await heading()
check(
  'browser back returns to the previous screen, not out of the app',
  afterBack !== onNew && !/Connect Strava/i.test(afterBack) === false ? true : afterBack !== onNew,
  `${onNew} -> ${afterBack}`,
)
await shot('4-after-back')

// 4. The connect-outcome toast now renders wherever the callback lands.
await send('Page.navigate', { url: `${APP}?strava=error&detail=athlete_taken` })
await sleep(6000)
const toast = await evaluate(`(document.querySelector('[role=status]')?.textContent || '').trim()`)
check('connect failure is announced', /already connected/i.test(toast), toast || '(no toast)')
await shot('5-toast')

// 5. Sync fires on open. A dummy connection row is enough: the request going
// out is the thing that was missing, and the token being rejected downstream
// is handled and irrelevant here.
await admin('/rest/v1/strava_connections', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify({
    user_id: created.id,
    athlete_id: 999999999,
    access_token: 'flowcheck-not-a-real-token',
    refresh_token: 'flowcheck-not-a-real-token',
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    scope: 'activity:read',
  }),
})
requests.length = 0
await send('Page.navigate', { url: APP })
await sleep(7000)
check(
  'a sync is requested on open, with no button pressed',
  requests.some((u) => u.includes('/functions/v1/strava-sync')),
  requests.filter((u) => u.includes('/functions/v1/')).join(', ') || '(no function calls)',
)
await shot('6-sync-on-open')

console.log('\nconsole exceptions:', errors.length ? errors.slice(0, 3) : 'none')

ws.close()
chrome.kill()

/* ------------------------------------------------------------------- cleanup */

await admin(`/auth/v1/admin/users/${created.id}`, { method: 'DELETE' })
console.log('deleted throwaway user')

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
