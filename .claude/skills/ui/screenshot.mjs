// Screenshot a page by driving headless Chrome over CDP.
//
//   node .claude/skills/ui/screenshot.mjs <url> <out.png> [width] [height] [waitMs] [light|dark] [clickSelector]
//
// clickSelector clicks one element before the shot, which is the only way to
// reach a screen's selected, expanded or error states -- the ones most likely
// to be broken, because nobody looks at them.
//
// Chrome's own --screenshot flag needs --virtual-time-budget, which advances
// time so fast that real network requests never finish: map tiles and fonts
// come back blank and the shot is a lie. Driving CDP lets us wait on the real
// clock, and report console errors and canvas size alongside the image.

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [url, out, width = '430', height = '930', waitMs = '9000', scheme, clickSel, keys] =
  process.argv.slice(2)
if (!url || !out) {
  console.error(
    'usage: screenshot.mjs <url> <out.png> [width] [height] [waitMs] [light|dark] [clickSelector] [keys=Tab,Tab]',
  )
  process.exit(1)
}

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9200 + Math.floor(Math.random() * 400)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    // Without a GPU, MapLibre and other WebGL canvases need software rendering.
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${width},${height}`,
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
if (!targets) {
  chrome.kill()
  throw new Error('Chrome devtools never came up')
}

const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))

let id = 0
const pending = new Map()
const problems = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.exceptionThrown') {
    problems.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description ?? ''))
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    problems.push('ERROR: ' + m.params.entry.text)
  }
})
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id
    pending.set(i, r)
    ws.send(JSON.stringify({ id: i, method, params }))
  })

await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
await send('Network.enable')
// Always test what is deployed, not what a stale worker is holding.
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Network.setBypassServiceWorker', { bypass: true })
// The app is white in light and black in dark, so a change verified in one
// can be invisible in the other. Force the scheme rather than inheriting the
// host's.
if (scheme) {
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: scheme }],
  })
}
await send('Page.navigate', { url })
await sleep(Number(waitMs))

if (clickSel) {
  // `text=Disconnect` clicks the control with that exact label. CSS alone
  // tends to match the first of several visually identical buttons, which
  // silently photographs the wrong state.
  const hit = await send('Runtime.evaluate', {
    expression: `(() => {
      const sel = ${JSON.stringify(clickSel)}
      let el
      if (sel.startsWith('text=')) {
        const want = sel.slice(5).trim()
        el = [...document.querySelectorAll('button, a, [role=button]')]
          .find(n => n.textContent.trim() === want)
      } else {
        el = document.querySelector(sel)
      }
      if (!el) return 'not found'
      el.click()
      return 'clicked'
    })()`,
    returnByValue: true,
  })
  console.log(`click ${clickSel}: ${hit.result.value}`)
  await sleep(1200)
}

// `keys=Tab,Tab,Tab` walks the keyboard focus order. Focus rings only appear
// under :focus-visible, which programmatic .focus() does not trigger -- so a
// real key event is the only way to photograph them.
if (keys) {
  for (const key of keys.replace(/^keys=/, '').split(',')) {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: key === 'Tab' ? 9 : key === 'Enter' ? 13 : 0,
        nativeVirtualKeyCode: key === 'Tab' ? 9 : key === 'Enter' ? 13 : 0,
      })
    }
    await sleep(120)
  }
  const focused = await send('Runtime.evaluate', {
    expression: `(document.activeElement?.textContent?.trim().slice(0, 40)
      || document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName)`,
    returnByValue: true,
  })
  console.log(`focus after ${keys}: ${focused.result.value}`)
  await sleep(400)
}

// Anything wider than the viewport is a layout bug worth seeing in numbers.
//
// Map markers and controls are excluded: a pin for a city beyond the current
// view is correctly off-screen, and reporting those would bury real clipping
// in noise.
const probe = await send('Runtime.evaluate', {
  expression: `(() => {
  // A page taller than the viewport is a feed, not a bug, so vertical
  // overflow only counts on a screen that does not scroll -- which is where
  // it means a card has run off the bottom.
  const scrolls = document.documentElement.scrollHeight > window.innerHeight + 1
  return JSON.stringify({
    overflowX: document.documentElement.scrollWidth > window.innerWidth
      ? document.documentElement.scrollWidth + ' > ' + window.innerWidth : 'none',
    pageHeight: document.documentElement.scrollHeight + (scrolls ? ' (scrolls)' : ''),
    clipped: [...document.querySelectorAll('body *')]
      .filter(el => !el.closest('.maplibregl-marker, .maplibregl-control-container, canvas'))
      .filter(el => { const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 &&
               (r.right > window.innerWidth + 1 || r.left < -1 ||
                (!scrolls && r.bottom > window.innerHeight + 1)) })
      .slice(0, 6)
      .map(el => {
        const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
        const r = el.getBoundingClientRect()
        return \`\${el.tagName.toLowerCase()}\${cls ? '.' + cls : ''} @\${Math.round(r.left)},\${Math.round(r.top)} \${Math.round(r.width)}x\${Math.round(r.height)}\`
      }),
  })
})()`,
  returnByValue: true,
})

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(out, Buffer.from(shot.data, 'base64'))

console.log(`wrote ${out}  (${width}x${height})`)
console.log('layout:', probe.result.value)
if (problems.length) console.log('console:\n  ' + [...new Set(problems)].slice(0, 8).join('\n  '))

ws.close()
chrome.kill()
