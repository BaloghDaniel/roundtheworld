import type { WeekBucket } from '../lib/stats'

const DAY_MS = 86_400_000

/**
 * Eight weeks of distance as bars.
 *
 * Sits inside the lime hero panel, so it draws in `on-accent` rather than a
 * theme colour: the panel is the same lime in both themes and a themed ink
 * would vanish in one of them.
 */
export default function WeekChart({ weeks }: { weeks: WeekBucket[] }) {
  if (weeks.length === 0) return null

  const peak = Math.max(...weeks.map((w) => w.m), 1)
  const last = weeks.length - 1

  // items-stretch, not items-end: a column sized by its own content is zero
  // tall, and the bars' percentage heights then resolve against nothing.
  return (
    <div className="flex h-16 items-stretch gap-1.5" aria-hidden>
      {weeks.map((w, i) => {
        // A zero week still gets a sliver, so the rhythm of the weeks stays
        // readable and a gap looks like a gap rather than a rendering fault.
        const pct = Math.max(3, (w.m / peak) * 100)
        return (
          <div key={w.start} className="flex flex-1 flex-col justify-end">
            <div
              className="bar-rise w-full rounded-sm"
              style={{
                height: `${pct}%`,
                background: 'currentColor',
                opacity: i === last ? 1 : 0.28,
                animationDelay: `${i * 45}ms`,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

/** "18 Aug – 24 Aug", the span the chart covers. */
export function weekSpan(weeks: WeekBucket[]): string {
  if (weeks.length === 0) return ''
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const first = new Date(weeks[0].start)
  const end = new Date(new Date(weeks[weeks.length - 1].start).getTime() + 6 * DAY_MS)
  return `${fmt(first)} – ${fmt(end)}`
}
