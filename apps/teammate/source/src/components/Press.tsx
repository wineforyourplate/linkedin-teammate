import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/* Buttons that feel physical on a phone, where there's no hover. The press is the
   feedback: the face sinks onto its edge under your finger, springs back on release,
   and Android gives a tiny buzz (iOS browsers have no web vibration). */

/** A tiny buzz on Android once the person has really tapped (browsers block it before that). */
export const buzz = (ms = 8) => {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  if (!ua || ua.hasBeenActive) navigator.vibrate?.(ms)
}

type PushTone = 'primary' | 'light' | 'dark' | 'quiet'

/** A chunky 3D button: a front that sits on a darker edge and presses down into it. */
export function PushButton({ tone = 'primary', size = 'lg', className, children, onPointerDown, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: PushTone; size?: 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      className={cn('push', `push-${tone}`, size === 'md' && 'push-md', className)}
      onPointerDown={(e) => { buzz(); onPointerDown?.(e) }}
      onTouchStart={() => undefined}
    >
      <span className="push-shadow" aria-hidden />
      <span className="push-edge" aria-hidden />
      <span className="push-front">{children}</span>
    </button>
  )
}

/** The rainbow button, rebuilt for this app: a white face on dark screens, a dark face on light ones. */
export function RainbowButton({ on = 'dark', className, children, onPointerDown, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: 'dark' | 'light' }) {
  return (
    <button {...rest} className={cn('rainbow-btn', on === 'dark' ? 'rainbow-on-dark' : 'rainbow-on-light', className)} onPointerDown={(e) => { buzz(); onPointerDown?.(e) }} onTouchStart={() => undefined}>
      <span className="relative z-[1] inline-flex items-center gap-2">{children}</span>
    </button>
  )
}

/** Press and hold to commit. Reports progress (0–1) so a mascot can charge up with it. */
export function HoldButton({ onDone, onProgress, children, doneLabel, tone = 'primary', ms = 1300, className }: { onDone: () => void; onProgress?: (p: number) => void; children: ReactNode; doneLabel?: ReactNode; tone?: PushTone; ms?: number; className?: string }) {
  const calm = useReducedMotion()
  const [p, setP] = useState(0)
  const [done, setDone] = useState(false)
  const [tease, setTease] = useState(false)
  const raf = useRef(0)
  const start = useRef(0)
  const set = (v: number) => { setP(v); onProgress?.(v) }
  const down = () => {
    if (done) return
    setTease(false)
    buzz(6)
    start.current = performance.now()
    const tick = (t: number) => {
      const v = Math.min(1, (t - start.current) / ms)
      set(v)
      if (v >= 1) {
        setDone(true)
        buzz(24)
        onDone()
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }
  const up = () => {
    if (done || !start.current) return
    cancelAnimationFrame(raf.current)
    if (performance.now() - start.current > 120) setTease(true)
    start.current = 0
    set(0)
  }
  return (
    <div className={cn('flex flex-col items-start gap-3', className)}>
      <motion.div animate={tease && !calm ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
        <button
          type="button"
          className={cn('push', `push-${tone}`, 'select-none')}
          style={{ touchAction: 'none' }}
          onPointerDown={down}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down() }}
          onKeyUp={up}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Press and hold to agree"
        >
          <span className="push-shadow" aria-hidden />
          <span className="push-edge" aria-hidden />
          <span className="push-front relative overflow-hidden">
            <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${(done ? 1 : p) * 100}%` }} aria-hidden />
            <span className="relative">{done ? doneLabel ?? children : p > 0 ? 'Shaking on it…' : children}</span>
          </span>
        </button>
      </motion.div>
      {tease && !done ? <p className="text-[14px] opacity-80">Commitment issues? Hold it a little longer.</p> : null}
    </div>
  )
}
