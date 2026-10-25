import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { buzz } from '@/components/Press'
import { Orb } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ART, CAST, type CastName } from './cast'

export type Mood =
  | 'idle' | 'working' | 'listening' | 'happy' | 'celebrate' | 'surprised' | 'wink' | 'love'
  | 'giggle' | 'dizzy' | 'sleepy' | 'shrug' | 'worried' | 'grumpy' | 'wave'
  | 'shy' | 'nervous' | 'hide' | 'drowsy' | 'smirk' | 'candid'

export interface MascotHandle {
  react: (mood: Mood, say?: string, ms?: number) => void
}

/* One of Lemma's cast characters (Spool by default), alive: it breathes, sways,
   blinks and glances on its own; its eyes follow the pointer (or the last tap on a
   phone, or the field being typed in); and it wears an expression for every mood.
   Pokes escalate, from a hello to a giggle to dizzy to hiding. Screens set a base
   `mood` and trigger one-off reactions through the ref.

   Drawn as layers in the portrait's 1254×1254 space: tinted feet and arms, the
   body art from lemma.work, and SVG eyes whose lids, pupils and shapes carry the
   expression. Everything per frame is set straight on the SVG, not through React. */

type Shape = 'round' | 'heart' | 'star' | 'x'
interface Face {
  joy: number // lower lids rising into a smile, 0–1
  close: [number, number] // upper lids, 0 open – 1 shut (left, right)
  happyClose?: boolean // shut eyes curve up (giggle) instead of down (asleep)
  pupil: number
  shape: Shape
  slant: number // + cross, − worried
  blush: number
  sweat: number
  look?: [number, number]
}
const BASE: Face = { joy: 0.12, close: [0, 0], pupil: 1, shape: 'round', slant: 0, blush: 0, sweat: 0 }
const FACES: Record<Mood, Partial<Face>> = {
  idle: {},
  working: { look: [-10, -9], joy: 0 },
  listening: { joy: 0.25 },
  happy: { joy: 1 },
  celebrate: { joy: 1, shape: 'star' },
  surprised: { joy: 0, pupil: 0.62 },
  wink: { joy: 0.7, close: [1, 0], happyClose: true },
  love: { joy: 0.6, shape: 'heart', blush: 0.8 },
  giggle: { joy: 1, close: [1, 1], happyClose: true },
  dizzy: { joy: 0, shape: 'x' },
  sleepy: { joy: 0, close: [1, 1] },
  drowsy: { joy: 0, close: [0.55, 0.55] },
  shrug: { joy: 0, close: [0.2, 0.2], look: [7, -4] },
  worried: { joy: 0, pupil: 0.8, slant: -12 },
  grumpy: { joy: 0, close: [0.35, 0.35], slant: 14 },
  wave: { joy: 0.9 },
  shy: { joy: 0.4, close: [1, 1], blush: 1 },
  nervous: { joy: 0, pupil: 0.62, slant: -10, sweat: 1 },
  hide: { joy: 0, close: [0.25, 0.25] },
  smirk: { joy: 0.3, close: [0.5, 0.5] },
  candid: { joy: 0, close: [0, 0.4] },
}

interface Pose { lift: number; lean: number; shake: number; tall: number; wide: number; armR: number; armL: number; step: number }
const env = (p: number) => (p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0)

/** How the body moves in a mood. `age` is seconds since the mood started, `t` the clock. */
function pose(mood: Mood, age: number, t: number, lift: number): Pose {
  const p: Pose = { lift: 0, lean: 0, shake: 0, tall: 1, wide: 1, armR: 9, armL: 0, step: 0 }
  switch (mood) {
    case 'working': p.lift = (Math.sin(t * 6) + 1) * 6; p.lean = -1.5; break
    case 'listening': p.lean = -3; break
    case 'happy': p.lift = Math.pow(env(age / 0.55), 0.7) * (lift * 1.5 + 30); p.armR = -7; break
    case 'celebrate': p.lift = age < 1.1 ? Math.pow(env((age % 0.55) / 0.55), 0.7) * (lift * 2 + 50) : 0; p.armR = -40; p.armL = 24; break
    case 'wave': p.armR = -7 + Math.sin(age * Math.PI * 2 * 1.6) * 16 * env(age / 1.8); p.lean = 2; p.lift = env(age / 1.8) * 12; p.step = env(age / 1.8) * 6; break
    case 'surprised': p.tall = 1 + 0.06 * env(age / 0.4); p.lift = env(age / 0.4) * 12; break
    case 'love': p.tall = 1 + 0.025 * Math.abs(Math.sin(age * 7)); p.armR = -5; break
    case 'giggle': p.shake = age < 0.9 ? Math.sin(age * 42) * 3 * (1 - age / 0.9) : 0; p.armR = -4; break
    case 'dizzy': p.shake = Math.sin(age * 8) * 6 * (1 - Math.min(age / 1.6, 1) * 0.6); break
    case 'sleepy': p.tall = 0.985; p.lean = 1.5; p.armR = 14; break
    case 'drowsy': p.lean = 0.8; p.armR = 12; break
    case 'shrug': p.armR = -26; p.armL = 26; p.lean = 3; p.lift = 6; break
    case 'shy': p.lean = -6; p.armR = 18; p.armL = 8; p.tall = 0.985; break
    case 'nervous': p.shake = Math.sin(t * 55) * 1.1; p.armR = 14; break
    case 'hide': p.tall = 0.62; p.wide = 1.08; p.lift = -40; p.armR = 14; break
    case 'smirk': p.lean = 4; break
    case 'candid': p.lean = -1.5; break
    case 'grumpy': p.armR = 14; p.tall = 0.99; break
    case 'worried': p.shake = Math.sin(t * 20) * 0.6; p.lean = -1; break
  }
  return p
}

const POKE_SINGLE: [Mood, string][] = [['happy', 'hi!'], ['wink', 'boop'], ['surprised', 'oh! hello'], ['love', 'hey you'], ['happy', 'yes?']]
const POKE_GIGGLE = ['hehe, stop', 'that tickles', 'ok ok 😆']
const DROWSY_AFTER = 30000
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt))
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

interface Props {
  character?: CastName
  mood?: Mood
  size?: number
  lookAt?: RefObject<HTMLElement | null> | null
  say?: string | null
  sleepAfter?: number
  quiet?: boolean
  pokable?: boolean
  className?: string
  onPoke?: (count: number) => void
}

export const CastMascot = forwardRef<MascotHandle, Props>(function CastMascot({ character = 'spool', mood = 'idle', size = 160, lookAt = null, say = null, sleepAfter = 60000, quiet = false, pokable = true, className, onPoke }, ref) {
  const rig = CAST[character]
  const id = useId().replace(/:/g, '')
  const host = useRef<HTMLDivElement>(null)
  const parts = useRef<Record<string, SVGElement | null>>({})
  const set = (k: string) => (el: SVGElement | null) => { parts.current[k] = el }

  const [reaction, setReaction] = useState<{ mood: Mood; say?: string; id: number } | null>(null)
  const [rest, setRest] = useState<'awake' | 'drowsy' | 'asleep'>('awake')
  const [burst, setBurst] = useState<{ id: number; kind: 'stars' | 'hearts' } | null>(null)
  const timer = useRef<number | null>(null)
  const last = useRef(Date.now())
  const taps = useRef({ n: 0, at: 0 })
  const seen = useRef<Record<string, number>>({})

  const react = useCallback((m: Mood, line?: string, ms = 1500) => {
    if (timer.current) window.clearTimeout(timer.current)
    const times = (seen.current[m] = (seen.current[m] || 0) + 1)
    if (times > 3) { line = undefined; ms = Math.min(ms, 900) }
    setReaction({ mood: m, say: line, id: Date.now() })
    if (m === 'celebrate') setBurst({ id: Date.now(), kind: 'stars' })
    if (m === 'love') setBurst({ id: Date.now(), kind: 'hearts' })
    timer.current = window.setTimeout(() => setReaction(null), ms)
  }, [])
  useImperativeHandle(ref, () => ({ react }), [react])

  // The art comes from lemma.work. If it can't load (offline, blocked), fall back to the orb.
  const [artOk, setArtOk] = useState(true)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setArtOk(true)
    img.onerror = () => setArtOk(false)
    img.src = `${ART}/extended/${character}-sm.webp`
  }, [character])

  const current: Mood = reaction?.mood ?? (rest === 'asleep' ? 'sleepy' : rest === 'drowsy' ? 'drowsy' : mood)
  const line = quiet ? null : reaction?.say ?? (rest === 'asleep' ? null : say)

  // What the animation loop reads each frame.
  const live = useRef({ mood: current, since: performance.now() / 1000, quiet })
  useEffect(() => {
    if (live.current.mood !== current || reaction) live.current = { mood: current, since: performance.now() / 1000, quiet }
    else live.current.quiet = quiet
  }, [current, reaction, quiet])

  // Inactivity: drowsy, then asleep. Any input wakes it.
  useEffect(() => {
    const wake = () => {
      last.current = Date.now()
      setRest((was) => {
        if (was === 'asleep') react('surprised', 'oh! I’m up', 1200)
        return 'awake'
      })
    }
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    const t = window.setInterval(() => {
      if (quiet || !sleepAfter || mood !== 'idle') return
      const idle = Date.now() - last.current
      setRest(idle > sleepAfter ? 'asleep' : idle > Math.min(DROWSY_AFTER, sleepAfter / 2) ? 'drowsy' : 'awake')
    }, 2000)
    return () => {
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      window.clearInterval(t)
    }
  }, [mood, sleepAfter, quiet, react])

  // The animation loop.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const aim = { x: 0, y: 0, at: 0 }
    const toward = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      const dx = cx - (r.left + r.width / 2)
      const dy = cy - (r.top + r.height * 0.4)
      const d = Math.max(1, Math.hypot(dx, dy))
      const k = Math.min(1, d / 260)
      aim.x = (dx / d) * k
      aim.y = (dy / d) * k
      aim.at = performance.now()
    }
    const onPointer = (e: PointerEvent) => { if (!lookAt?.current) toward(e.clientX, e.clientY) }
    window.addEventListener('pointermove', onPointer)
    window.addEventListener('pointerdown', onPointer)
    let visible = true
    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true })
    io.observe(el)
    const gain = Math.max(1, Math.min(3, 150 / size))
    const s = { x: 0, y: 0, joy: 0.12, cl: 0, cr: 0, pupil: 1, slant: 0, blush: 0, sweat: 0, lean: 0, tall: 1, wide: 1, armR: 9, armL: 0, crouch: 0 }
    let raf = 0
    let prev = performance.now()
    let blinkAt = -10
    let nextBlink = 1.5 + Math.random() * 2
    let glance = { x: 0, y: 0, until: 0 }
    let nextGlance = 4
    let lookTick = 0
    const P = parts.current
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden) return
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      const t = now / 1000
      const still = reduced.matches
      const { mood: m, since, quiet: q } = live.current
      const age = t - since
      const f = { ...BASE, ...FACES[m] }
      const body = still ? { lift: 0, lean: 0, shake: 0, tall: 1, wide: 1, armR: 9, armL: 0, step: 0 } : pose(m, age, t, rig.lift)

      // Where to look: a fixed look for the mood, else the field being typed in, else the pointer, else a glance.
      if (lookAt?.current && now - lookTick > 180) {
        lookTick = now
        const r = lookAt.current.getBoundingClientRect()
        const len = (lookAt.current as HTMLInputElement).value?.length || 0
        toward(r.left + Math.min(r.width - 10, 30 + len * 8), r.top + r.height / 2)
      }
      if (!still && t > nextGlance && now - aim.at > 3000) {
        glance = { x: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5), y: (Math.random() - 0.6) * 0.7, until: t + 1.6 }
        nextGlance = t + 4 + Math.random() * 3
      }
      const tracking = now - aim.at < 3000 || !!lookAt?.current
      const gx = f.look ? f.look[0] : tracking ? aim.x * 13 : t < glance.until ? glance.x * 12 : 0
      const gy = f.look ? f.look[1] : tracking ? aim.y * 12 : t < glance.until ? glance.y * 9 : 0
      s.x = damp(s.x, gx, 16, dt)
      s.y = damp(s.y, gy, 16, dt)

      // Blink now and then, unless the eyes are shut anyway.
      if (!still && t > nextBlink) { blinkAt = t; nextBlink = t + 3.4 + Math.random() * 3.2 }
      const blink = env((t - blinkAt) / 0.19)
      s.joy = damp(s.joy, f.joy, 7, dt)
      s.cl = damp(s.cl, f.close[0], 10, dt)
      s.cr = damp(s.cr, f.close[1], 10, dt)
      s.pupil = damp(s.pupil, f.pupil, 10, dt)
      s.slant = damp(s.slant, f.slant, 8, dt)
      s.blush = damp(s.blush, f.blush, 5, dt)
      s.sweat = damp(s.sweat, f.sweat, 6, dt)

      // Breath and sway underneath everything.
      const breath = still || q ? 0 : (Math.sin(t * 1.85) * 0.78 + Math.sin(t * 0.766) * 0.22) * gain
      const sway = still || q ? 0 : Math.sin(t * 0.41) * 0.62 + Math.sin(t * 0.631 + 1.7) * 0.38
      s.lean = damp(s.lean, body.lean, 5, dt)
      s.tall = damp(s.tall, body.tall, 9, dt)
      s.wide = damp(s.wide, body.wide, 9, dt)
      s.armR = damp(s.armR, body.armR, 8, dt)
      s.armL = damp(s.armL, body.armL, 8, dt)
      const crouchTarget = body.lift < 0 ? body.lift : 0
      s.crouch = damp(s.crouch, crouchTarget, 9, dt)
      const hop = body.lift > 0 ? body.lift * gain : 0

      P.root?.setAttribute('transform', `translate(0 ${-(hop + s.crouch + breath * 9)}) rotate(${s.lean + body.shake + sway * 2} 630 1050)`)
      const tall = s.tall + breath * 0.018
      const wide = s.wide - breath * 0.008
      P.torso?.setAttribute('transform', `translate(630 885) scale(${wide} ${tall}) translate(-630 -885)`)
      P.armR?.setAttribute('transform', `rotate(${s.armR + sway * 3} 900 650)`)
      P.armL?.setAttribute('transform', `rotate(${s.armL - sway * 2} 350 650)`)
      P.footL?.setAttribute('transform', `rotate(${body.step} 520 870)`)

      const lower = 66 - s.joy * 23
      ;[0, 1].forEach((i) => {
        const shut = Math.min(1, (i === 0 ? s.cl : s.cr) + blink * (1 - (i === 0 ? s.cl : s.cr)))
        const top = -70 + shut * 145
        P[`pupil${i}`]?.setAttribute('transform', `translate(${s.x} ${s.y}) scale(${s.pupil})`)
        P[`lower${i}`]?.setAttribute('d', `M-70 80V${lower}Q0 ${lower - 14 * s.joy} 70 ${lower}V80Z`)
        P[`upper${i}`]?.setAttribute('d', `M-72 -80H72V${top}Q0 ${top + 10} -72 ${top}Z`)
        P[`lid${i}`]?.setAttribute('transform', `rotate(${i === 0 ? s.slant : -s.slant})`)
        const crease = P[`crease${i}`]
        if (crease) {
          crease.setAttribute('opacity', String(Math.pow(shut, 5)))
          crease.setAttribute('d', f.happyClose ? 'M-34 14Q0 -10 34 14' : 'M-32 5Q0 20 32 5')
        }
        for (const sh of ['round', 'heart', 'star', 'x'] as Shape[]) P[`${sh}${i}`]?.setAttribute('display', f.shape === sh ? 'inline' : 'none')
      })
      P.blush?.setAttribute('opacity', String(s.blush * 0.75))
      P.sweat?.setAttribute('opacity', String(s.sweat))
      P.sweat?.setAttribute('transform', `translate(0 ${s.sweat > 0.5 ? Math.sin(t * 3) * 6 : 0})`)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [character, rig, size, lookAt])

  const Hit = pokable ? 'button' : 'span'
  const poke = () => {
    if (!pokable) return
    buzz(8)
    last.current = Date.now()
    setRest('awake')
    const now = Date.now()
    taps.current = { n: now - taps.current.at < 1500 ? taps.current.n + 1 : 1, at: now }
    const n = taps.current.n
    onPoke?.(n)
    if (n >= 9) { taps.current = { n: 0, at: 0 }; react('hide', 'I’ll be over here.', 2600) }
    else if (n >= 6) react('dizzy', 'whoa… too many boops', 1800)
    else if (n >= 3) react('giggle', pick(POKE_GIGGLE), 1300)
    else { const [m, l] = pick(POKE_SINGLE); react(m, l, 1400) }
  }

  const tint = rgb(rig.color)
  const footTint = rgb('foot' in rig && rig.foot ? rig.foot : rig.color)
  const shade = (k: number) => `rgb(${footTint.map((c) => Math.round(Math.min(1, c * k) * 255)).join(' ')})`
  const filter = (name: string, c: number[]) => (
    <filter id={`${id}-${name}`} colorInterpolationFilters="sRGB">
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncR type="linear" slope={c[0] * 1.65} intercept={c[0] * 0.06} />
        <feFuncG type="linear" slope={c[1] * 1.65} intercept={c[1] * 0.06} />
        <feFuncB type="linear" slope={c[2] * 1.65} intercept={c[2] * 0.06} />
      </feComponentTransfer>
    </filter>
  )
  const wide = 'wide' in rig && rig.wide
  const high = 'highArm' in rig && rig.highArm
  const star = Array.from({ length: 10 }, (_, k) => { const r = k % 2 ? 17 : 40; const a = (Math.PI / 5) * k - Math.PI / 2; return `${r * Math.cos(a)},${r * Math.sin(a)}` }).join(' ')

  return (
    <div ref={host} className={cn('relative inline-block select-none', className)} style={{ width: size, height: size }}>
      <AnimatePresence mode="wait">
        {line ? (
          <motion.div
            key={line}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95, transition: { duration: 0.08 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="pointer-events-none absolute bottom-[88%] left-[62%] z-10 whitespace-nowrap rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[13px] text-[#1B1530] shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
            style={{ fontWeight: 500 }}
            role="status"
          >
            {line}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {rest === 'asleep' && !quiet ? <Zzz /> : null}
      <AnimatePresence>{burst ? <Burst key={burst.id} kind={burst.kind} onDone={() => setBurst(null)} /> : null}</AnimatePresence>
      {!artOk ? <div className="pointer-events-none absolute inset-0 grid place-items-center"><Orb size={Math.round(size * 0.55)} breathing={current !== 'sleepy'} /></div> : null}
      {/* Not pokable means something around it is the button (Spool in the corner), so it's no button of its own. */}
      <Hit
        {...(pokable ? { type: 'button' as const } : {})}
        onPointerDown={poke}
        onTouchStart={() => undefined}
        aria-label={pokable ? `${rig.name}, your teammate. Poke it.` : undefined}
        className={cn('block size-full rounded-full [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-periwinkle', pokable ? 'cursor-pointer' : 'cursor-default')}
        style={{ touchAction: 'manipulation' }}
      >
        <svg viewBox="0 0 1254 1254" width={size} height={size} aria-hidden overflow="visible" style={artOk ? undefined : { visibility: 'hidden' }}>
          <defs>
            <clipPath id={`${id}-cl`}><path d="M0 0H627V1254H0Z" /></clipPath>
            <clipPath id={`${id}-cr`}><path d="M627 0H1254V1254H627Z" /></clipPath>
            <clipPath id={`${id}-fl`}><path d="M285 970H600V1220H285Z" /></clipPath>
            <clipPath id={`${id}-fr`}><path d="M650 970H1000V1220H650Z" /></clipPath>
            {filter('tint', tint)}
            {filter('feet', footTint)}
            {['l', 'r'].map((side) => (
              <linearGradient key={side} id={`${id}-leg-${side}`} gradientUnits="userSpaceOnUse" x1={side === 'l' ? 480 : 710} x2={side === 'l' ? 570 : 790}>
                <stop stopColor={shade(0.62)} />
                <stop offset=".38" stopColor={shade(1.12)} />
                <stop offset="1" stopColor={shade(0.76)} />
              </linearGradient>
            ))}
            <radialGradient id={`${id}-white`} cx="32%" cy="24%" r="76%"><stop stopColor="#fffdf5" /><stop offset=".45" stopColor="#f5eddf" /><stop offset=".8" stopColor="#ded0bb" /><stop offset="1" stopColor="#ad8c70" /></radialGradient>
            <radialGradient id={`${id}-black`} cx="32%" cy="22%"><stop stopColor="#484441" /><stop offset=".5" stopColor="#161313" /><stop offset="1" stopColor="#080808" /></radialGradient>
            <linearGradient id={`${id}-lid`} x2=".3" y2="1"><stop stopColor="#fff9ed" /><stop offset="1" stopColor="#d9c9b1" /></linearGradient>
            <clipPath id={`${id}-eye`}><ellipse rx="56" ry="64" /></clipPath>
            <filter id={`${id}-shadow`} x="-40%" y="-40%" width="190%" height="190%"><feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#33284a" floodOpacity=".3" /></filter>
          </defs>
          <ellipse cx="640" cy="1150" rx="260" ry="34" fill="#000" opacity=".22" />
          <g transform="translate(-50 -15) scale(1.08)">
            <g ref={set('root')}>
              {(['l', 'r'] as const).map((side) => (
                <g key={side} ref={side === 'l' ? set('footL') : undefined}>
                  <g transform={wide ? `translate(${side === 'l' ? -130 : 130} 0)` : undefined}>
                    <path d={side === 'l' ? 'M535 790Q525 845 520 930' : 'M715 790Q735 850 749 930'} fill="none" stroke={`url(#${id}-leg-${side})`} strokeWidth="77" strokeLinecap="round" />
                    <g transform="translate(125 100) scale(.8)" filter={`url(#${id}-feet)`}>
                      <image href={`${ART}/pleat-v2/base-sm.webp`} width="1254" height="1254" clipPath={`url(#${id}-f${side})`} />
                    </g>
                  </g>
                </g>
              ))}
              <g ref={set('torso')}>
                {(['l', 'r'] as const).map((side) => (
                  <g key={side} ref={set(side === 'l' ? 'armL' : 'armR')}>
                    <g transform={`translate(${wide ? (side === 'l' ? 45 : 140) : 100} ${high && side === 'r' ? -60 : 95}) scale(.8)`} filter={`url(#${id}-tint)`}>
                      <image href={`${ART}/pleat-v2/arms-sm.webp`} width="1254" height="1254" clipPath={`url(#${id}-c${side})`} />
                    </g>
                  </g>
                ))}
                <image href={`${ART}/extended/${character}-sm.webp`} width="1254" height="1254" transform={`translate(${(1254 - 1254 * rig.scale) / 2} ${rig.y}) scale(${rig.scale})`} />
                <g ref={set('blush')} opacity="0">
                  {rig.eyes.map(([ex, ey], i) => <ellipse key={i} cx={ex + (i === 0 ? -22 : 22)} cy={ey + 92} rx="44" ry="22" fill="#ff7fa6" />)}
                </g>
                {rig.eyes.map(([ex, ey], i) => (
                  <g key={i} transform={`translate(${ex} ${ey}) scale(1.05)`}>
                    <ellipse rx="56" ry="64" fill={`url(#${id}-white)`} filter={`url(#${id}-shadow)`} />
                    <g clipPath={`url(#${id}-eye)`}>
                      <g ref={set(`pupil${i}`)}>
                        <g ref={set(`round${i}`)}>
                          <ellipse cy="-2" rx="37" ry="43" fill={`url(#${id}-black)`} />
                          <ellipse cx="-9" cy="-15" rx="10" ry="11" fill="white" opacity=".7" />
                        </g>
                        <path ref={set(`heart${i}`)} display="none" d="M0 30C-46 2-30-40 0-14C30-40 46 2 0 30Z" fill="#ff4f81" stroke="#8a1238" strokeWidth="3" />
                        <polygon ref={set(`star${i}`)} display="none" points={star} fill="#ffd23f" stroke="#7a5a00" strokeWidth="3" strokeLinejoin="round" />
                        <path ref={set(`x${i}`)} display="none" d="M-26-26L26 26M26-26L-26 26" stroke="#161313" strokeWidth="13" strokeLinecap="round" />
                      </g>
                      <path ref={set(`lower${i}`)} d="M-70 80V64Q0 64 70 64V80Z" fill={`url(#${id}-lid)`} stroke="#a99275" strokeOpacity=".18" strokeWidth="1.5" />
                      <g ref={set(`lid${i}`)}>
                        <path ref={set(`upper${i}`)} d="M-72 -80H72V-70Q0 -60 -72 -70Z" fill={`url(#${id}-lid)`} />
                      </g>
                      <path ref={set(`crease${i}`)} d="M-32 5Q0 20 32 5" fill="none" stroke="#79604c" strokeWidth="4" strokeLinecap="round" opacity="0" />
                    </g>
                  </g>
                ))}
                <path ref={set('sweat')} opacity="0" d={`M${rig.eyes[1][0] + 70} ${rig.eyes[1][1] - 110}q26 36 0 54q-26-18 0-54Z`} fill="#9fd8ff" stroke="#2b5d80" strokeWidth="4" />
              </g>
            </g>
          </g>
        </svg>
      </Hit>
    </div>
  )
})

function Zzz() {
  return (
    <div className="pointer-events-none absolute right-2 top-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="absolute text-[14px] text-periwinkle" style={{ fontWeight: 700, right: -4 - i * 10, top: 6 - i * 13 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: [0, 1, 0], y: [6, -10] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.6 }}>
          z
        </motion.span>
      ))}
    </div>
  )
}

function Burst({ kind, onDone }: { kind: 'stars' | 'hearts'; onDone: () => void }) {
  const items = Array.from({ length: 9 }, (_, i) => ({ i, a: (Math.PI * 2 * i) / 9 + Math.random() * 0.4, d: 60 + Math.random() * 30 }))
  return (
    <div className="pointer-events-none absolute left-1/2 top-[38%]" aria-hidden>
      {items.map(({ i, a, d }) => (
        <motion.span
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 text-[16px]"
          style={{ color: kind === 'stars' ? '#FFD54A' : '#FF5C8A' }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 12, opacity: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          onAnimationComplete={i === 0 ? onDone : undefined}
        >
          {kind === 'stars' ? (i % 2 ? '✦' : '★') : '♥'}
        </motion.span>
      ))}
    </div>
  )
}
