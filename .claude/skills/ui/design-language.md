# Design language

Five colours: an acid lime, a near-black teal, and three warm greys. Off-white
in light, the deep teal in dark, and the lime carrying every action and every
figure worth being proud of. Closer to a sports watch than a dashboard. On a
journey screen the map is the page and everything else floats above it.

## Theme

Colours are CSS variables on `:root` in `src/index.css`, flipped by
`prefers-color-scheme` and overridden by `data-theme="light" | "dark"`. Tailwind
utilities point at them through `@theme inline`, so `bg-surface` and `text-ink`
follow the theme automatically. Never hardcode a hex in a component.

`src/lib/theme.ts` owns the choice (`system` by default) and persists it.
`index.html` applies a stored choice before first paint, so a dark-mode user
never sees a white flash.

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `canvas` | `#e9ebe6` | `#061414` | The page |
| `surface` | `#ffffff` | `#0b1e1e` | Cards |
| `raised` | `#e4e6e0` | `#122626` | Inputs, hover, inert buttons |
| `ink` | `#061414` | `#e9ebe6` | Primary text |
| `muted` | `#6b6e62` | `#96998c` | Secondary text |
| `hair` | `#d2d3ce` | 22% `#96998c` | Borders |
| `accent` | `#bcff00` | `#bcff00` | Fills: buttons, bars, the hero panel |
| `on-accent` | `#061414` | `#061414` | Anything drawn *on* the lime |
| `accent-ink` | `#3f5b00` | `#bcff00` | Accent-coloured **text** |
| `danger` | `#a51c14` | `#ff8a80` | Errors only |
| `done` | `#bcff00` | `#bcff00` | Distance covered |
| `ahead` | `#96998c` | `#96998c` | Distance remaining |

### The lime is a fill, not a text colour

`#bcff00` sits at 88% luminance. On the dark ground it is a 14:1 headline; on
the pale one it is invisible. So:

- **Filling** something — a button, a progress bar, the week panel, a chip —
  use `bg-accent` with `text-on-accent`. Identical in both themes, which is
  what makes the brand feel like one thing.
- **Colouring text or an icon** — use `text-accent-ink`, which is the lime in
  dark and a dark olive in light. `text-accent` on a pale card is a bug.
- Want the lime's punch in light-mode text anyway? Highlight it instead:
  `bg-accent text-on-accent` behind the word, the way the sign-in headline
  does. It reads the same in both themes.

`done` and `ahead` are the two route colours on the map and the two ends of
every progress reading. Covered distance is the lime; what is left is the
neutral grey. Neither changes with the theme — a route that recolours itself
when the basemap flips stops being readable as progress. A progress *track* is
`bg-ahead/25`, never `bg-raised`: raised is a whisker from the card behind it
and an empty bar disappears.

## Brand colours are not themeable

Strava orange (`#FC4C02`) and the white Google button carry their own fixed
foreground — `text-white` and `text-zinc-900`. Running a theme token through
them turns the label invisible in one mode.

## Utilities

- `card` — solid panel, for pages that are not over the map.
- `card-hero` — the same with a deeper shadow, for the one panel that should
  be looked at first.
- `card-accent` — the lime ground, for the single loudest figure on a screen.
  There is at most one per screen.
- `glass` — translucent, blurred, for panels floating on the map.
- `eyebrow` — 10px all-caps label. Always **above** the thing it labels.
- `readout` — the figure: extrabold, `tabular-nums` so digits do not jitter.
- `chip` — a small status pill: earned badge, lap counter, mode label.
- `btn-accent` — primary pill. Disabled goes neutral (`raised`/`muted`) rather
  than translucent, because a half-opacity lime on the dark ground reads as a
  muddy olive rather than as inert.
- `btn-quiet` — secondary outline. `field` — text input.
- `screen` — the fade every top-level `<main>` carries. `count-in` — the beat
  a figure gets when it lands. Both disabled under `prefers-reduced-motion`.

## Typography

`eyebrow` above `readout` is the core unit; reach for it before inventing
another way to present a number. Screen headline `text-[1.75rem]` to
`text-[2.75rem]`, extrabold, `tracking-tighter`. Hero figure `text-5xl`, stat
grid `text-xl`, prose `text-sm text-muted` with `text-pretty` beyond one line.

## Progress is the point

The home screen exists to make someone want to log another run, so the numbers
that show effort accumulating get the space: this week's distance on the lime
panel, eight weeks of bars under it, then totals, then the journeys. Badges
show a **ring filling toward the next one** rather than a locked padlock — a
badge at 80% is a reason to go out, a badge at nothing is furniture.

## Voice

Short and factual: "412.0 km", "3 282 km still to go", "at this pace",
"4.8 km up on last week". No exclamation marks. The one place warmth belongs is
arrival: "You made it."
