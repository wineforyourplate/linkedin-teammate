import { createContext, useContext, useEffect, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { CastMascot, type MascotHandle, type Mood } from '@/components/cast/CastMascot'
import { Button } from '@/components/ui'
import type { Profile, Screen, Step } from '@/lib/types'
import { cn } from '@/lib/utils'

/* The onboarding's shape and its pieces, on warm paper: ten screens in four chapters, Spool
   beside a speech bubble at the top of each, a serif question, then the actions right under
   the content (they stick to the bottom only on phones). Skipped questions come back later
   as one small card at a time, rendered by the same components in compact form. */

export const SCREENS: Screen[] = ['profile', 'goals', 'dest', 'deal', 'world', 'signin', 'reveal', 'stand', 'first', 'week']
export const CHAPTERS: { name: string; screens: Screen[] }[] = [
  { name: 'You', screens: ['profile'] },
  { name: 'What you want', screens: ['goals', 'dest', 'deal'] },
  { name: 'Your world', screens: ['world', 'signin', 'reveal'] },
  { name: 'Your start', screens: ['stand', 'first', 'week'] },
]

/** Where someone is: their saved screen, or the nearest one to where the first onboarding left them. */
export function screenOf(p: Profile | null): Screen {
  if (p?.onboarding_screen && SCREENS.includes(p.onboarding_screen)) return p.onboarding_screen
  const LEGACY: Partial<Record<Step, Screen>> = { goals: 'goals', tone: 'deal', voice: 'deal', worries: 'deal', rhythm: 'deal', deal: 'deal', browser: 'signin', learned: 'reveal', plan: 'week', first: 'week' }
  return LEGACY[p?.onboarding_step as Step] || 'profile'
}

/** Questions that can wait. Skipped ones come back as a quick question, one a day. */
export const OPTIONAL: Step[] = ['dest', 'goals', 'tone', 'voice', 'worries', 'rhythm']

/** The answer a skipped question falls back to, so nothing waits on it. */
export const DEFAULTS: Partial<Record<Step, Record<string, unknown>>> = {
  rhythm: { meeting_time: 'With my first coffee', posting_time: '08:30', posts_per_week: 2, posting_days: ['tue', 'thu'], brief_channel: 'app' },
}

export function answered(step: Step, p: Profile | null): boolean {
  if (!p) return false
  switch (step) {
    case 'goals':
      return !!(p.goals?.length || p.goal_note)
    case 'dest':
      return !!p.destination && !p.destination.guess
    case 'tone':
      return !!p.tone
    case 'voice':
      return !!p.voice_mode
    case 'worries':
      return Array.isArray(p.worries)
    case 'rhythm':
      return !!p.posting_time
    case 'browser':
      return p.browser_status === 'signed_in' || !!p.linkedin_api
    default:
      return true
  }
}

// ── context: compact (a card in the app) or full screen ──────────────────────

interface Flow {
  /** Compact: a card in the 10-minute run rather than a full screen. */
  compact: boolean
  skip?: () => void
  /** "Decide later" in onboarding, "Not now" in the app. */
  skipLabel?: string
}
const FlowCtx = createContext<Flow>({ compact: false })
export const FlowProvider = ({ value, children }: { value: Flow; children: ReactNode }) => <FlowCtx.Provider value={value}>{children}</FlowCtx.Provider>
export const useFlow = () => useContext(FlowCtx)

/* Spool, reachable from any screen: a mood, a quick reaction (a face, and a few words in the
   bubble), or eyes on a field. Outside onboarding these do nothing. */
interface MascotApi {
  react: (mood: Mood, say?: string, ms?: number) => void
  mood: (mood: Mood) => void
  look: (el: RefObject<HTMLElement | null> | null) => void
}
const MascotCtx = createContext<MascotApi>({ react: () => undefined, mood: () => undefined, look: () => undefined })
export const MascotProvider = ({ value, children }: { value: MascotApi; children: ReactNode }) => <MascotCtx.Provider value={value}>{children}</MascotCtx.Provider>
export const useMascot = () => useContext(MascotCtx)

/** What the shell hands the mascot on each screen. */
export interface SpoolState {
  ref: RefObject<MascotHandle | null>
  mood: Mood
  lookAt: RefObject<HTMLElement | null> | null
  /** A reaction's words, shown in the bubble for a moment. */
  flash: string | null
}
const SpoolCtx = createContext<SpoolState | null>(null)
export const SpoolProvider = ({ value, children }: { value: SpoolState; children: ReactNode }) => <SpoolCtx.Provider value={value}>{children}</SpoolCtx.Provider>

// ── the pieces ────────────────────────────────────────────────────────────────

/** Spool and its bubble, one unit. The bubble gives context; the heading under it asks. */
export function Spool({ children }: { children: ReactNode }) {
  const s = useContext(SpoolCtx)
  const { compact } = useFlow()
  const phone = usePhone()
  if (compact || !s) return null
  return (
    <div className="flex items-center gap-1">
      <CastMascot ref={s.ref} mood={s.mood} lookAt={s.lookAt} size={phone ? 62 : 76} sleepAfter={0} quiet className="-my-2 -ml-2 shrink-0" />
      <motion.div key={s.flash || 'line'} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="relative min-w-0 rounded-2xl bg-surface px-3.5 py-2.5 text-[14.5px] leading-snug text-ink-2 shadow-[0_1px_0_var(--color-line),0_8px_22px_-16px_rgba(30,26,43,.4)]">
        <span aria-hidden className="absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 rounded-[2px] bg-surface" />
        <span className="relative block" aria-live="polite">{s.flash || children}</span>
      </motion.div>
    </div>
  )
}

/** True under 640px, kept current as the window changes. */
export function usePhone() {
  const q = '(max-width: 639px)'
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  const { compact } = useFlow()
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className={cn('text-ink', compact ? 'text-[22px] leading-snug' : 'text-[29px] leading-[1.08] sm:text-[36px]')} style={{ fontFamily: 'var(--font-display)', fontWeight: 520 }}>
        {children}
      </h1>
      {sub ? <p className="text-[15.5px] leading-relaxed text-ink-2">{sub}</p> : null}
    </div>
  )
}

/** The screen's actions, right under the content. On phones they stick to the bottom. */
export function Actions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const { compact } = useFlow()
  return (
    <div className={cn('z-10 flex flex-col gap-2', compact ? 'mt-1' : 'pt-1 max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:bg-[linear-gradient(180deg,rgb(248_245_239/0),var(--color-canvas)_26%)] max-sm:px-4 max-sm:pb-[max(14px,env(safe-area-inset-bottom))] max-sm:pt-4')}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {note ? <p className="text-[12.5px] text-slate">{note}</p> : null}
    </div>
  )
}

/** A screen's main action. */
export function Primary({ children, busy, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  const { compact } = useFlow()
  return <Button variant="primary" size={compact ? 'md' : 'lg'} busy={busy} className={cn(!compact && 'px-7', className)} {...rest}>{children}</Button>
}

/** The quiet second action: "Decide later", "Not me", "Keep it as a draft". On its own (`solo`) it gets a soft fill, so it still reads as a button. */
export function Quiet({ children, className, solo, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { solo?: boolean }) {
  const { compact } = useFlow()
  return <Button variant={solo ? 'tint' : 'ghost'} size={compact ? 'md' : 'lg'} className={cn(!compact && 'px-5', solo && 'bg-surface ring-1 ring-line hover:bg-surface hover:ring-ink/30', className)} {...rest}>{children}</Button>
}

/** "Decide later" (onboarding) or "Not now" (the app), when the question can wait. */
export function Later() {
  const { skip, skipLabel } = useFlow()
  if (!skip) return null
  return <Quiet onClick={skip}>{skipLabel || 'Decide later'}</Quiet>
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5', className)}>{children}</div>
}

/** A big tappable choice: emoji, title, a line under it. */
export function Tile({ on, onClick, emoji, title, sub, badge }: { on: boolean; onClick: () => void; emoji: string; title: string; sub?: string; badge?: string }) {
  return (
    <motion.button type="button" aria-pressed={on} onClick={onClick} whileTap={{ scale: 0.97 }} className={cn('relative flex min-h-[64px] flex-col items-start gap-0.5 rounded-[18px] bg-surface px-3.5 py-3 text-left ring-1 transition-shadow', on ? 'ring-2 ring-ink' : 'ring-line hover:ring-ink/30')} style={{ touchAction: 'manipulation' }}>
      {badge ? <span className="absolute right-2.5 top-2 text-[10px] uppercase tracking-[0.06em] text-accent" style={{ fontWeight: 700 }}>{badge}</span> : null}
      <span className="text-[21px] leading-tight" aria-hidden>{emoji}</span>
      <span className="text-[15px] leading-snug text-ink" style={{ fontWeight: 560 }}>{title}</span>
      {sub ? <span className="text-[12.5px] leading-snug text-ink-2">{sub}</span> : null}
    </motion.button>
  )
}

/** A small toggle pill. */
export function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn('min-h-10 rounded-pill px-4 text-[14.5px] ring-1 transition-colors', on ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink ring-ink/15 hover:ring-ink/35')} style={{ touchAction: 'manipulation' }}>
      {children}
    </button>
  )
}

/** Chips you can remove, and a dashed field to add one more. */
export function ChipField({ items, onRemove, onAdd, placeholder, tone = 'bg-lavender', label }: { items: { key: string; text: string }[]; onRemove: (key: string) => void; onAdd: (text: string) => void; placeholder: string; tone?: string; label: string }) {
  const [v, setV] = useState('')
  const add = () => {
    const t = v.trim()
    if (!t) return
    onAdd(t)
    setV('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !v && items.length) onRemove(items[items.length - 1].key)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <span key={i.key} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-pill py-1.5 pl-3.5 pr-1.5 text-[14px] text-ink', tone)}>
          <span className="truncate">{i.text}</span>
          <button type="button" onClick={() => onRemove(i.key)} className="grid size-6 shrink-0 place-items-center rounded-full bg-white/75 text-ink-2 hover:text-ink" aria-label={`Remove ${i.text}`}><X className="size-3" strokeWidth={2.5} /></button>
        </span>
      ))}
      <span className="flex min-w-[180px] flex-1 items-center rounded-pill border-[1.5px] border-dashed border-ink/20 px-3.5 focus-within:border-solid focus-within:border-ink">
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={placeholder} aria-label={label} enterKeyHint="done" className="h-9 min-w-0 flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-slate focus:outline-none" />
      </span>
    </div>
  )
}

export const inputClass = 'h-12 w-full rounded-[14px] border-[1.5px] border-ink/15 bg-surface px-4 text-[16px] text-ink placeholder:text-slate focus:border-ink focus:outline-none'
