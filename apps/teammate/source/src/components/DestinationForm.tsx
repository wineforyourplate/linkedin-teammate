import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Destination } from '@/lib/types'
import { DESTS, LADDERS, destOf } from '@/lib/world'
import { cn } from '@/lib/utils'

/* Where people go after a post lands: six choices, and each asks for what it needs (a link,
   and one follow-up). "Nothing yet" asks for nothing. Shared by the onboarding, the quick
   question that brings it back, and Personalization. */

export function DestinationForm({ value, onChange, guessed, ladder = false, compact = false }: { value: Destination | null; onChange: (d: Destination) => void; guessed?: Destination['kind'] | null; ladder?: boolean; compact?: boolean }) {
  const linkRef = useRef<HTMLInputElement>(null)
  const opt = destOf(value?.kind)
  const pick = (kind: Destination['kind']) => {
    // keep what they typed for this choice if they come back to it
    onChange({ kind, link: kind === value?.kind ? value.link : kind === 'none' ? null : value?.kind && value.kind !== 'none' ? value.link : null, detail: kind === value?.kind ? value.detail : null })
    if (kind !== 'none') window.setTimeout(() => linkRef.current?.focus({ preventScroll: true }), 120)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className={cn('grid grid-cols-2 gap-2.5', !compact && 'sm:grid-cols-3')} role="radiogroup" aria-label="Where should people go next?">
        {DESTS.map((d) => {
          const on = value?.kind === d.kind
          return (
            <motion.button key={d.kind} type="button" role="radio" aria-checked={on} onClick={() => pick(d.kind)} whileTap={{ scale: 0.97 }} className={cn('relative flex min-h-[64px] flex-col items-start gap-0.5 rounded-[18px] bg-surface px-3.5 py-3 text-left ring-1 transition-shadow', on ? 'ring-2 ring-ink' : 'ring-line hover:ring-ink/30')} style={{ touchAction: 'manipulation' }}>
              {guessed === d.kind ? <span className="absolute right-2.5 top-2 text-[10px] uppercase tracking-[0.06em] text-accent" style={{ fontWeight: 700 }}>My guess</span> : null}
              <span className="text-[21px] leading-tight" aria-hidden>{d.emoji}</span>
              <span className="text-[15px] leading-snug text-ink" style={{ fontWeight: 560 }}>{d.title}</span>
              <span className="text-[12.5px] leading-snug text-ink-2">{d.sub}</span>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {opt ? (
          <motion.div key={opt.kind} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
            {opt.link ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="dest-link" className="text-[14px] text-ink" style={{ fontWeight: 560 }}>{opt.link.label}</label>
                <input
                  id="dest-link"
                  ref={linkRef}
                  value={value?.link || ''}
                  onChange={(e) => onChange({ ...(value as Destination), link: e.target.value })}
                  placeholder={opt.link.placeholder}
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="h-12 w-full rounded-[14px] border-[1.5px] border-ink/15 bg-surface px-4 text-[16px] text-ink placeholder:text-slate focus:border-ink focus:outline-none"
                />
                {opt.ask ? (
                  <>
                    <p className="mt-1.5 text-[13px] text-ink-2">{opt.ask.question}</p>
                    <div className="flex flex-wrap gap-2">
                      {opt.ask.options.map((o) => (
                        <button key={o} type="button" aria-pressed={value?.detail === o} onClick={() => onChange({ ...(value as Destination), detail: value?.detail === o ? null : o })} className={cn('min-h-10 rounded-pill px-4 text-[14px] ring-1 transition-colors', value?.detail === o ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink ring-ink/15 hover:ring-ink/35')}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                <p className="mt-1 text-[12.5px] text-slate">I tag the link on every post, so you’ll see which post sent people.</p>
              </div>
            ) : (
              <p className="text-[14.5px] text-ink-2"><span className="text-ink" style={{ fontWeight: 560 }}>That’s fine.</span> Your posts will end on a real question, with no link. In a month I’ll suggest a destination from who’s reaching out.</p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {ladder && value?.kind ? (
        <div className="mt-2">
          <p className="text-[15px] text-ink" style={{ fontWeight: 560 }}>How your posts will end</p>
          <ul className="mt-2 flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            {LADDERS[value.kind].map(([a, b]) => (
              <li key={a} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="shrink-0 text-[13px] text-ink sm:w-28" style={{ fontWeight: 560 }}>{a}</span>
                <span className="text-[14px] text-ink-2">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
