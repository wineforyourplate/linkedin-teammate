import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* Mercury's rule: one saturated indigo action per view; everything else whispers
   (translucent pills). Light type weights; size and colour carry the hierarchy. */

type Variant = 'primary' | 'tint' | 'ghost' | 'glass' | 'quiet'
type Size = 'md' | 'sm' | 'lg'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }>(
  function Button({ variant = 'tint', size = 'md', busy, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || busy}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-pill whitespace-nowrap transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
          size === 'md' && 'h-10 px-5 text-[15px]',
          size === 'sm' && 'h-8 px-4 text-[13px]',
          size === 'lg' && 'h-12 px-7 text-[16px]',
          variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-hover',
          variant === 'tint' && 'bg-primary/10 text-ink hover:bg-primary/15',
          variant === 'ghost' && 'text-ink-2 hover:bg-primary/8 hover:text-ink',
          variant === 'glass' && 'border border-[#afb2ce]/35 bg-[#afb2ce]/20 text-on-dark hover:bg-[#afb2ce]/30',
          variant === 'quiet' && 'text-fog hover:text-on-dark',
          className,
        )}
        style={{ fontWeight: 420 }}
        {...rest}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    )
  },
)

/** The teammate's presence: a soft periwinkle orb that breathes while it thinks or works. */
export function Orb({ size = 96, breathing = true, className }: { size?: number; breathing?: boolean; className?: string }) {
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 30%, #c9d6f6 0%, #9cb4e8 38%, #5266eb 78%, rgba(82,102,235,0) 100%)', filter: 'blur(0.5px)' }}
        animate={breathing ? { scale: [1, 1.08, 1], opacity: [0.92, 1, 0.92] } : { scale: 1 }}
        transition={breathing ? { duration: 5.5, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ inset: -size * 0.35, background: 'radial-gradient(circle, rgba(156,180,232,0.28) 0%, rgba(156,180,232,0) 65%)' }}
        animate={breathing ? { scale: [0.9, 1.1, 0.9], opacity: [0.5, 0.9, 0.5] } : { opacity: 0.6 }}
        transition={breathing ? { duration: 5.5, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
    </div>
  )
}

/** Segmented progress pill (after 21st.dev's Segmented Progress Pill Stepper). */
export function ProgressPill({ total, current, dark = false }: { total: number; current: number; dark?: boolean }) {
  const seg = 100 / total
  return (
    <div className={cn('relative h-1.5 w-full rounded-full', dark ? 'bg-white/10' : 'bg-lavender')} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-label={`Step ${current + 1} of ${total}`}>
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', dark ? 'bg-periwinkle/30' : 'bg-primary/20')}
        initial={false}
        animate={{ width: `${current * seg}%` }}
        transition={{ type: 'spring', stiffness: 150, damping: 22 }}
      />
      <motion.div
        className={cn('absolute inset-y-0 rounded-full', dark ? 'bg-periwinkle' : 'bg-primary')}
        initial={false}
        animate={{ left: `${current * seg}%`, width: `${seg}%` }}
        transition={{ type: 'spring', stiffness: 150, damping: 22 }}
      />
    </div>
  )
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-primary' : 'bg-[#d9d8e8]',
      )}
    >
      <motion.span
        className="absolute left-1 size-5 rounded-full bg-white shadow-sm"
        initial={false}
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      />
    </button>
  )
}

export function Status({ text, tone }: { text: string; tone: 'on' | 'off' | 'attention' | 'muted' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] tabular whitespace-nowrap',
        tone === 'on' && 'bg-primary/10 text-primary',
        tone === 'off' && 'bg-[#efeff4] text-slate',
        tone === 'attention' && 'bg-[#fff3e6] text-[#8a4b00]',
        tone === 'muted' && 'bg-[#efeff4] text-slate',
      )}
      style={{ fontWeight: 480 }}
    >
      {tone === 'on' ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
      {text}
    </span>
  )
}

export function Card({ children, className, tint = false }: { children: ReactNode; className?: string; tint?: boolean }) {
  return <section className={cn('rounded-md p-6', tint ? 'bg-lavender' : 'bg-surface ring-1 ring-line', className)}>{children}</section>
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('eyebrow text-ink-2', className)}>{children}</p>
}

/** A vertical activity feed (after 21st.dev's Onboarding Activity Feed). */
export function Feed({ items, dark = false, empty }: { items: { id: string; text: string; meta?: string; done?: boolean; tone?: 'warning' }[]; dark?: boolean; empty?: string }) {
  if (!items.length) return empty ? <p className={cn('text-[14px]', dark ? 'text-fog' : 'text-slate')}>{empty}</p> : null
  return (
    <ol className="relative flex flex-col gap-3">
      <span className={cn('absolute bottom-2 left-[7px] top-2 w-px', dark ? 'bg-white/10' : 'bg-line')} aria-hidden />
      {items.map((it, i) => (
        <motion.li key={it.id} className="relative flex items-start gap-3" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.03 }}>
          <span className={cn('relative z-10 mt-1 grid size-[15px] shrink-0 place-items-center rounded-full', it.tone === 'warning' ? 'bg-[#b4232f]' : dark ? 'bg-periwinkle' : 'bg-primary')}>
            <Check className="size-2.5 text-white" strokeWidth={3} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={cn('text-[14px] leading-snug', dark ? 'text-on-dark' : 'text-ink')}>{it.text}</p>
            {it.meta ? <p className={cn('mt-0.5 text-[12px]', dark ? 'text-fog/70' : 'text-slate')}>{it.meta}</p> : null}
          </div>
        </motion.li>
      ))}
    </ol>
  )
}

/** A tap answer. With an `icon` (an emoji marker), the marker springs when picked instead of a check. */
export function Chip({ selected, onClick, children, dark = false, icon }: { selected: boolean; onClick: () => void; children: ReactNode; dark?: boolean; icon?: string }) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-pill px-5 text-[15px] transition-colors duration-200',
        icon && 'pl-4',
        dark
          ? selected
            ? 'bg-periwinkle text-night'
            : 'bg-white/[0.06] text-on-dark ring-1 ring-white/10 hover:bg-white/10'
          : selected
            ? 'bg-primary text-on-primary'
            : 'bg-primary/8 text-ink hover:bg-primary/12',
      )}
      style={{ fontWeight: 420 }}
    >
      {icon ? (
        <motion.span
          key={selected ? 'on' : 'off'}
          aria-hidden
          className="inline-block text-[17px] leading-none"
          initial={selected ? { scale: 0.3, rotate: -25 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 13 }}
        >
          {icon}
        </motion.span>
      ) : selected ? (
        <Check className="size-4" aria-hidden />
      ) : null}
      {children}
    </motion.button>
  )
}
