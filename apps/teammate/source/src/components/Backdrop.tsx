import { useEffect, useRef, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { Clouds } from './Clouds'

/* Onboarding backgrounds. All animate transforms or CSS variables only (cheap on
   phones), and hold still under reduced motion.
   - aurora ("glow"): two cool fields and one warm one, with film grain; it brightens as
     you progress (night)
   - spotlight: a dot grid lit around your pointer, or around the mascot on touch
     screens, which have no pointer (night)
   - paper: cool off-white graph paper with grain (day) */

export type BackdropKind = 'aurora' | 'spotlight' | 'paper' | 'plain-night' | 'plain-day' | 'clouds' | 'clouds-day'

export function Backdrop({ kind, className, progress = 1, anchor }: { kind: BackdropKind; className?: string; progress?: number; anchor?: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (kind !== 'spotlight') return
    const el = ref.current
    if (!el) return
    let raf = 0
    // Touch screens have no pointer to follow: light up around the anchor (the mascot) instead.
    if (anchor && window.matchMedia('(hover: none)').matches) {
      const t = window.setInterval(() => {
        const a = anchor.current?.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        if (!a) return
        el.style.setProperty('--mx', `${a.left + a.width / 2 - r.left}px`)
        el.style.setProperty('--my', `${a.top + a.height / 2 - r.top}px`)
      }, 250)
      return () => window.clearInterval(t)
    }
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', move)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      cancelAnimationFrame(raf)
    }
  }, [kind, anchor])
  const glow = { ['--glow' as string]: String(0.45 + 0.55 * Math.max(0, Math.min(1, progress))) }

  if (kind === 'clouds' || kind === 'clouds-day') return <Clouds tone={kind === 'clouds' ? 'dusk' : 'day'} className={className} />
  if (kind === 'aurora')
    return (
      <div ref={ref} aria-hidden className={cn('bg-aurora pointer-events-none', className)} style={glow}>
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
        <span className="grain" />
      </div>
    )
  if (kind === 'spotlight')
    return (
      <div ref={ref} aria-hidden className={cn('bg-spot pointer-events-none', className)} style={glow}>
        <span className="glow" />
        <span className="dots" />
        <span className="dots-lit" />
        <span className="grain" />
      </div>
    )
  if (kind === 'paper')
    return (
      <div ref={ref} aria-hidden className={cn('bg-paper pointer-events-none', className)} style={glow}>
        <span className="blob p1" />
        <span className="blob p2" />
        <span className="blob p3" />
        <span className="grain grain-dark" />
      </div>
    )
  return <div aria-hidden className={cn('pointer-events-none', kind === 'plain-day' ? 'bg-[#F5F6FA]' : 'bg-night', className)} />
}
