import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/* Soft clouds (Vanta's clouds shader), tuned calm: slow drift, no mouse or tilt
   steering, a dimmed sun, and rendered at a lower resolution (clouds are soft
   anyway, and it keeps phones cool). Loaded only when used. Holds still under
   reduced motion, pauses when the tab is hidden, and has a scrim so text stays
   readable on top. */

type Palette = Record<'backgroundColor' | 'skyColor' | 'cloudColor' | 'cloudShadowColor' | 'sunColor' | 'sunGlareColor' | 'sunlightColor', number>

const PALETTES: Record<'dusk' | 'day', Palette> = {
  dusk: { backgroundColor: 0x171721, skyColor: 0x2b2459, cloudColor: 0x7a70c8, cloudShadowColor: 0x14112a, sunColor: 0xff9f7a, sunGlareColor: 0x6b4fa0, sunlightColor: 0xc98a9e },
  day: { backgroundColor: 0xeef0fa, skyColor: 0x9fb6ef, cloudColor: 0xf4f2ff, cloudShadowColor: 0x8d93c8, sunColor: 0xffe2b8, sunGlareColor: 0xd9d3ff, sunlightColor: 0xfff0d8 },
}

type Effect = { destroy: () => void; setOptions: (o: Record<string, unknown>) => void }

export function Clouds({ tone = 'dusk', speed = 0.35, className }: { tone?: 'dusk' | 'day'; speed?: number; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let effect: Effect | null = null
    let gone = false
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    void (async () => {
      const THREE = await import('three')
      const mod = (await import('vanta/dist/vanta.clouds.min')) as unknown as { default: (o: Record<string, unknown>) => Effect }
      if (gone || !el.current) return
      effect = mod.default({
        el: el.current,
        THREE,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 2, // half the device pixels: softer and cheaper
        scaleMobile: 3,
        speed: calm ? 0 : speed,
        ...PALETTES[tone],
      })
    })()
    const onVis = () => effect?.setOptions({ speed: document.hidden || calm ? 0 : speed })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', onVis)
      effect?.destroy()
    }
  }, [tone, speed])
  return (
    <div aria-hidden className={cn('pointer-events-none overflow-hidden', tone === 'dusk' ? 'bg-[#171721]' : 'bg-[#eef0fa]', className)}>
      <div ref={el} className="absolute inset-0" />
      <div className={cn('absolute inset-0', tone === 'dusk' ? 'bg-gradient-to-b from-[#171721]/10 via-[#171721]/35 to-[#171721]/80' : 'bg-gradient-to-b from-white/0 via-white/30 to-white/70')} />
    </div>
  )
}
