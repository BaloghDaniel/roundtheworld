import type { Badge } from '../lib/stats'

/**
 * A badge tile: a ring that fills as the badge is approached, lime once earned.
 *
 * The ring matters more than the icon. A locked badge showing 80% is a reason
 * to go running; a locked badge showing nothing is furniture.
 */
export function BadgeTile({ badge }: { badge: Badge }) {
  const R = 18
  const C = 2 * Math.PI * R

  return (
    <li className="flex w-[3.6rem] shrink-0 flex-col items-center gap-1.5 text-center">
      <div className="relative grid size-11 place-items-center">
        <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={R} fill="none" stroke="var(--c-hair)" strokeWidth="3" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke={badge.earned ? 'var(--c-accent)' : 'var(--c-ahead)'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - badge.progress)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span
          className={`grid size-8 place-items-center rounded-full ${
            badge.earned ? 'bg-accent text-on-accent' : 'bg-raised text-muted'
          }`}
        >
          {badge.earned ? (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          )}
        </span>
      </div>
      <span
        className={`text-[10px] font-bold leading-tight ${
          badge.earned ? 'text-ink' : 'text-muted'
        }`}
      >
        {badge.name}
      </span>
    </li>
  )
}

/** The whole set, scrolling sideways on a phone rather than wrapping to rows. */
export default function Badges({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="eyebrow">Achievements</h2>
        <span className="text-[11px] tabular-nums text-muted">
          {earned} of {badges.length}
        </span>
      </div>
      <div className="card px-2 py-4">
        <ul className="flex justify-between gap-1.5 overflow-x-auto px-1">
          {badges.map((b) => (
            <BadgeTile key={b.id} badge={b} />
          ))}
        </ul>
      </div>
    </section>
  )
}
