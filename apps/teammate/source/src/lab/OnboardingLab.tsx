import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, SlidersHorizontal, X } from 'lucide-react'
import { CastMascot, type MascotHandle, type Mood } from '@/components/cast/CastMascot'
import { Signature } from '@/components/Signature'
import { CAST, CAST_NAMES, type CastName } from '@/components/cast/cast'
import { HoldButton, PushButton, RainbowButton } from '@/components/Press'
import { Backdrop, type BackdropKind } from '@/components/Backdrop'
import { cn } from '@/lib/utils'

/* Dev-only lab (?lab): a new look for onboarding, tried on localhost before it goes
   into the app. A short flow with fake answers, plus a kit page with every mascot
   mood, button and background. Nothing here touches real data. */

type Theme = 'night' | 'day'
type Btn = 'push' | 'rainbow'
type Screen = 'hello' | 'profile' | 'goals' | 'tone' | 'deal' | 'connect' | 'done'
const SCREENS: Screen[] = ['hello', 'profile', 'goals', 'tone', 'deal', 'connect', 'done']
type Font = 'inter' | 'bricolage' | 'fraunces'
const FONTS: Record<Font, string> = { inter: 'Inter, ui-sans-serif, system-ui, sans-serif', bricolage: '"Bricolage Grotesque", Inter, sans-serif', fraunces: 'Fraunces, Georgia, serif' }

const GOALS = [
  { key: 'customers', emoji: '🤝', label: 'Win more customers' },
  { key: 'hiring', emoji: '🧲', label: 'Hire great people' },
  { key: 'known', emoji: '🎤', label: 'Be known for what I know' },
  { key: 'audience', emoji: '📈', label: 'Grow an audience' },
  { key: 'raise', emoji: '💸', label: 'Raise money' },
  { key: 'back', emoji: '🔁', label: 'Get back into posting' },
]
const CHEERS = ['nice', 'good one', 'yes!', 'ooh', 'love that']
const MOODS: Mood[] = ['idle', 'wave', 'happy', 'celebrate', 'working', 'listening', 'surprised', 'wink', 'love', 'giggle', 'dizzy', 'sleepy', 'drowsy', 'shrug', 'worried', 'grumpy', 'shy', 'nervous', 'hide', 'smirk', 'candid']
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem('lab.' + k)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem('lab.' + k, JSON.stringify(v))
  } catch {
    /* fine */
  }
}

export function OnboardingLab() {
  const [theme, setTheme] = useState<Theme>(() => load('theme', 'night'))
  const [bg, setBg] = useState<BackdropKind>(() => load('bg', 'clouds'))
  const [btn, setBtn] = useState<Btn>(() => load('btn', 'push'))
  const [view, setView] = useState<'flow' | 'kit'>(() => load('view', 'flow'))
  const [screen, setScreen] = useState<Screen>('hello')
  const [font, setFont] = useState<Font>(() => load('font', 'bricolage'))
  const [quiet, setQuiet] = useState<boolean>(() => load('quiet', false))
  const [who, setWho] = useState<CastName>(() => load('who', 'spool'))
  useEffect(() => save('who', who), [who])
  const mascotBox = useRef<HTMLDivElement>(null)
  useEffect(() => save('font', font), [font])
  useEffect(() => save('quiet', quiet), [quiet])
  // Display faces for headlines, loaded only here in the lab.
  useEffect(() => {
    if (document.getElementById('lab-fonts')) return
    const l = document.createElement('link')
    l.id = 'lab-fonts'
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Fraunces:opsz,wght@9..144,400..700&display=swap'
    document.head.appendChild(l)
  }, [])
  useEffect(() => save('theme', theme), [theme])
  useEffect(() => save('bg', bg), [bg])
  useEffect(() => save('btn', btn), [btn])
  useEffect(() => save('view', view), [view])
  // Keep the background matched to the theme.
  useEffect(() => {
    if (theme === 'day' && (bg === 'aurora' || bg === 'spotlight' || bg === 'plain-night' || bg === 'clouds')) setBg(bg === 'clouds' ? 'clouds-day' : 'paper')
    if (theme === 'night' && (bg === 'paper' || bg === 'plain-day' || bg === 'clouds-day')) setBg(bg === 'clouds-day' ? 'clouds' : 'aurora')
  }, [theme, bg])

  const night = theme === 'night'
  return (
    <div className={cn('relative isolate min-h-screen overflow-x-hidden', night ? 'text-on-dark' : 'text-[#1B1530]')}>
      <Backdrop kind={bg} className="fixed inset-0 -z-10" progress={view === 'flow' ? SCREENS.indexOf(screen) / (SCREENS.length - 1) : 1} anchor={mascotBox} />
      <LabCtx.Provider value={{ btn, night, font: FONTS[font], quiet, who }}>
        {view === 'flow' ? <Flow theme={theme} screen={screen} setScreen={setScreen} mascotBox={mascotBox} /> : <Kit theme={theme} />}
      </LabCtx.Provider>
      <Controls theme={theme} setTheme={setTheme} bg={bg} setBg={setBg} btn={btn} setBtn={setBtn} view={view} setView={setView} screen={screen} setScreen={setScreen} font={font} setFont={setFont} quiet={quiet} setQuiet={setQuiet} who={who} setWho={setWho} />
    </div>
  )
}

/* ---------- the flow ---------- */

function Flow({ theme, screen, setScreen, mascotBox }: { theme: Theme; screen: Screen; setScreen: (s: Screen) => void; mascotBox: RefObject<HTMLDivElement | null> }) {
  const { quiet, who } = useContext(LabCtx)
  const night = theme === 'night'
  const m = useRef<MascotHandle>(null)
  const i = SCREENS.indexOf(screen)
  const next = () => setScreen(SCREENS[Math.min(i + 1, SCREENS.length - 1)])
  const back = () => setScreen(SCREENS[Math.max(i - 1, 0)])
  const [mood, setMood] = useState<Mood>('idle')
  const [lookAt, setLookAt] = useState<RefObject<HTMLElement | null> | null>(null)

  useEffect(() => {
    setMood('idle')
    setLookAt(null)
    const t = window.setTimeout(() => {
      if (screen === 'hello') m.current?.react('wave', 'hi! 👋 poke me if you like', 2600)
      if (screen === 'done') m.current?.react('celebrate', 'day one, done!', 2200)
    }, 450)
    return () => window.clearTimeout(t)
  }, [screen])

  const sub = night ? 'text-fog' : 'text-[#554e7b]'
  const card = night ? 'rounded-2xl bg-white/[0.05] ring-1 ring-white/10' : 'sticker'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-28 pt-6 sm:px-8">
      <header className="flex items-center gap-4">
        <button type="button" onClick={back} disabled={i === 0} className={cn('grid size-10 place-items-center rounded-full text-[20px] disabled:invisible', night ? 'hover:bg-white/5' : 'hover:bg-black/5')} aria-label="Back">←</button>
        <div className={cn('relative h-2 flex-1 overflow-hidden rounded-full', night ? 'bg-white/10' : 'bg-[#1B1530]/10')}>
          <motion.div className="absolute inset-y-0 left-0 rounded-full bg-[#8B74FF]" animate={{ width: `${((i + 1) / SCREENS.length) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      </header>
      <main className="flex flex-1 flex-col justify-center py-8">
        <AnimatePresence mode="wait">
          <motion.div key={screen} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-7">
            <div ref={mascotBox} className="-mb-4 -ml-3 w-fit"><CastMascot ref={m} character={who} mood={mood} lookAt={lookAt} quiet={quiet} size={screen === 'hello' || screen === 'done' ? 220 : 140} /></div>

            {screen === 'hello' && (
              <>
                <Title sub="I’ll help you show up on LinkedIn without it taking over your week. Four minutes, skip what you like, and nothing goes out without you." subClass={sub}>Hi. I’m your growth teammate.</Title>
                <div><Cta onClick={next}>Let’s begin</Cta></div>
              </>
            )}

            {screen === 'profile' && <Profile sub={sub} card={card} night={night} m={m} setMood={setMood} setLookAt={setLookAt} next={next} />}

            {screen === 'goals' && <Goals sub={sub} night={night} m={m} next={next} />}

            {screen === 'tone' && <Tone sub={sub} card={card} night={night} setMood={setMood} m={m} next={next} />}

            {screen === 'deal' && (
              <>
                <Title subClass={sub}>How we’ll work together</Title>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={cn('p-5', card)}>
                    <p className={cn('eyebrow', sub)}>Your side</p>
                    <ul className="mt-3 flex flex-col gap-2 text-[15.5px]"><li>About 10 minutes a day</li><li>Approve what goes out</li><li>Tell me what doesn’t sound like you</li></ul>
                  </div>
                  <div className={cn('p-5', card)}>
                    <p className={cn('eyebrow', sub)}>My side</p>
                    <ul className="mt-3 flex flex-col gap-2 text-[15.5px]"><li>Write in your voice</li><li>Never post without your OK</li><li>Stay inside safe limits</li></ul>
                  </div>
                </div>
                <Signature night={night} sub={sub} onDone={() => { setMood('idle'); m.current?.react('celebrate', 'deal! 🤝 I’ll bring the coffee', 2200); window.setTimeout(next, 2600) }} onHolding={(h) => setMood(h ? 'nervous' : 'idle')} />
              </>
            )}

            {screen === 'connect' && <Connect sub={sub} card={card} night={night} m={m} setMood={setMood} next={next} />}

            {screen === 'done' && (
              <>
                <Title sub="Right now I’m collecting post ideas, checking your profile and reading up on your company. It all lands on Today." subClass={sub}>Day one, done.</Title>
                <div><Cta onClick={() => setScreen('hello')}>Go to Today</Cta></div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

const LabCtx = createContext<{ btn: Btn; night: boolean; font: string; quiet: boolean; who: CastName }>({ btn: 'push', night: true, font: FONTS.inter, quiet: false, who: 'spool' })

/** The main action, in whichever style the lab is set to. */
function Cta({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  const { btn, night } = useContext(LabCtx)
  return btn === 'rainbow' ? (
    <RainbowButton on={night ? 'dark' : 'light'} onClick={onClick} disabled={disabled}>{children}</RainbowButton>
  ) : (
    <PushButton tone={night ? 'primary' : 'dark'} onClick={onClick} disabled={disabled}>{children}</PushButton>
  )
}

function Title({ children, sub, subClass }: { children: ReactNode; sub?: ReactNode; subClass: string }) {
  const { font } = useContext(LabCtx)
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[34px] leading-[1.08] sm:text-[46px]" style={{ fontFamily: font, fontWeight: font.startsWith('Inter') ? 480 : 600, letterSpacing: font.startsWith('Inter') ? '-0.01em' : '-0.02em' }}>{children}</h1>
      {sub ? <p className={cn('max-w-xl text-[17px] leading-relaxed', subClass)}>{sub}</p> : null}
    </div>
  )
}

function Profile({ sub, card, night, m, setMood, setLookAt, next }: { sub: string; card: string; night: boolean; m: RefObject<MascotHandle | null>; setMood: (x: Mood) => void; setLookAt: (r: RefObject<HTMLElement | null> | null) => void; next: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const valid = /linkedin\.com\/in\/[^/?#]+/i.test(url)
  const was = useRef(false)
  useEffect(() => {
    if (valid && !was.current) m.current?.react('happy', undefined, 1200) // no bubbles while they type
    was.current = valid
  }, [valid, m])
  return (
    <>
      <Title sub="Connect LinkedIn and I’ll know it’s you in seconds. Or paste your link and we keep going." subClass={sub}>Let’s start with you.</Title>
      <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={() => m.current?.react('surprised', 'ooh, the fast way', 1500)} className={cn('flex items-center gap-4 p-5 text-left', card)}>
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#0a66c2] text-[18px] text-white" style={{ fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>in</span>
        <span className="min-w-0 flex-1"><span className="block text-[17px]" style={{ fontWeight: 500 }}>Connect LinkedIn</span><span className={cn('mt-0.5 block text-[14px]', sub)}>Quickest. Your exact profile in seconds.</span></span>
      </motion.button>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => { setMood('listening'); setLookAt(input) }}
          onBlur={() => { setMood('idle'); setLookAt(null) }}
          placeholder="linkedin.com/in/your-name"
          className={cn('h-[52px] flex-1 rounded-full px-5 text-[16px] focus:outline-none', night ? 'border border-white/15 bg-white/[0.05] placeholder:text-fog/50 focus:border-[#8B74FF]' : 'border border-[#1B1530]/15 bg-white placeholder:text-[#1B1530]/40 focus:border-[#6B52F0]')}
        />
        <Cta onClick={next} disabled={!valid}>Use this link</Cta>
      </div>
    </>
  )
}

function Goals({ sub, night, m, next }: { sub: string; night: boolean; m: RefObject<MascotHandle | null>; next: () => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (k: string) => {
    const on = !picked.includes(k)
    const nextPicked = on ? [...picked, k] : picked.filter((x) => x !== k)
    setPicked(nextPicked)
    if (on && nextPicked.length >= 4) m.current?.react('surprised', 'ambitious. I like it.', 1700)
    else if (on) m.current?.react('happy', pick(CHEERS), 1000)
  }
  return (
    <>
      <Title sub="Pick as many as you like." subClass={sub}>What do you want LinkedIn to do for you?</Title>
      <div className="flex flex-wrap gap-2.5">
        {GOALS.map((g) => {
          const on = picked.includes(g.key)
          return (
            <motion.button
              key={g.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(g.key)}
              whileTap={{ scale: 0.93 }}
              animate={on ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.28 }}
              className={cn('inline-flex min-h-12 items-center gap-2 rounded-full pl-4 pr-5 text-[15.5px] transition-colors', on ? 'bg-[#8B74FF] text-white' : night ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-white ring-1 ring-[#1B1530]/10')}
              style={{ fontWeight: 450, touchAction: 'manipulation' }}
            >
              <motion.span key={String(on)} initial={on ? { scale: 0.3, rotate: -25 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 13 }} className="text-[18px] leading-none" aria-hidden>{g.emoji}</motion.span>
              {g.label}
            </motion.button>
          )
        })}
      </div>
      <div className="flex flex-col items-start gap-2">
        <Cta onClick={next} disabled={!picked.length}>Continue</Cta>
        <button type="button" onClick={() => { m.current?.react('shrug', 'fair. later then', 1200); window.setTimeout(next, 900) }} className={cn('rounded-full px-3 py-2 text-[14px]', sub)}>Skip this question</button>
      </div>
    </>
  )
}

const TONES = [
  { key: 'polite', emoji: '😊', label: 'Polite', mood: 'happy' as Mood, take: 'Clear and confident. One line on who you help would make it land even harder.' },
  { key: 'candid', emoji: '🧐', label: 'Candid', mood: 'candid' as Mood, take: 'It says what you are, not why anyone should care. Add who you help and one result.' },
  { key: 'roast', emoji: '🔥', label: 'Roast me', mood: 'smirk' as Mood, take: '“Founder at Northwind.” Bold of you to assume we all know what Northwind does. Who do you help, and how?' },
]

function Tone({ sub, card, night, setMood, m, next }: { sub: string; card: string; night: boolean; setMood: (x: Mood) => void; m: RefObject<MascotHandle | null>; next: () => void }) {
  const [tone, setTone] = useState<string | null>(null)
  const t = TONES.find((x) => x.key === tone)
  return (
    <>
      <Title sub="About your profile, your drafts and your ideas. You can change it anytime." subClass={sub}>How honest should I be with you?</Title>
      <div className="grid grid-cols-3 gap-2.5">
        {TONES.map((x) => (
          <motion.button
            key={x.key}
            type="button"
            aria-pressed={tone === x.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setTone(x.key); setMood(x.mood); if (x.key === 'roast') m.current?.react('giggle', 'oh, this’ll be fun', 1400) }}
            className={cn('flex flex-col items-center gap-1.5 rounded-2xl px-2 py-4 text-[15px] transition-colors', tone === x.key ? 'bg-[#8B74FF] text-white' : night ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-white ring-1 ring-[#1B1530]/10')}
            style={{ fontWeight: 480, touchAction: 'manipulation' }}
          >
            <span className="text-[26px] leading-none" aria-hidden>{x.emoji}</span>
            {x.label}
          </motion.button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {t ? (
          <motion.div key={t.key} initial={{ opacity: 0, y: 8, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0 }} className={cn('p-5', card)}>
            <p className={cn('text-[13px]', sub)}>A taste, on a headline like “Founder at Northwind”:</p>
            <p className="mt-2 text-[17px] leading-relaxed">{t.take}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div><Cta onClick={next} disabled={!tone}>Continue</Cta></div>
    </>
  )
}

const STAGES = ['Waking up your computer', 'Opening a private browser', 'Going to LinkedIn', 'Your turn: sign in']

function Connect({ sub, card, night, m, setMood, next }: { sub: string; card: string; night: boolean; m: RefObject<MascotHandle | null>; setMood: (x: Mood) => void; next: () => void }) {
  const [stage, setStage] = useState(-1)
  useEffect(() => {
    if (stage < 0 || stage >= 3) return
    const t = window.setTimeout(() => setStage((s) => s + 1), 1400)
    return () => window.clearTimeout(t)
  }, [stage])
  useEffect(() => {
    if (stage >= 0 && stage < 3) setMood('working')
    if (stage === 3) { setMood('shy'); m.current?.react('shy', 'your turn. I’m not looking 🙈', 2200) }
  }, [stage, setMood, m])
  return (
    <>
      <Title sub="LinkedIn keeps swipeable PDF carousels away from apps. To post those, I work in a private browser that’s yours, signed in by you." subClass={sub}>Connect your accounts</Title>
      <div className={cn('p-5', card)}>
        {stage < 0 ? (
          <div className="flex flex-wrap gap-3">
            <PushButton tone={night ? 'light' : 'dark'} size="md" onClick={() => { m.current?.react('shrug', 'no rush', 1200) }}>Do it later</PushButton>
            <PushButton tone="quiet" size="md" onClick={() => setStage(0)}>Sign in now</PushButton>
          </div>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {STAGES.map((s, k) => (
              <li key={s} className={cn('flex items-center gap-3 text-[15px] transition-opacity', k > stage && 'opacity-40')}>
                <span className={cn('grid size-5 place-items-center rounded-full', k < stage ? 'bg-[#8B74FF] text-white' : 'ring-1 ring-current')}>
                  {k < stage ? <Check className="size-3" strokeWidth={3} /> : k === stage ? <span className="size-1.5 animate-pulse rounded-full bg-[#8B74FF]" /> : null}
                </span>
                {s}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div><Cta onClick={next}>Continue</Cta></div>
    </>
  )
}

/* ---------- the kit ---------- */

function Kit({ theme }: { theme: Theme }) {
  const night = theme === 'night'
  const { who } = useContext(LabCtx)
  const big = useRef<MascotHandle>(null)
  const [base, setBase] = useState<Mood>('idle')
  const sub = night ? 'text-fog' : 'text-[#554e7b]'
  const tile = night ? 'bg-white/[0.04] ring-1 ring-white/10' : 'sticker'
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-12 px-5 pb-32 pt-10 sm:px-8">
      <section className="flex flex-col gap-6">
        <div>
          <p className={cn('eyebrow', sub)}>Lemma’s cast</p>
          <h1 className="mt-2 text-[32px] leading-tight sm:text-[40px]" style={{ fontWeight: 480 }}>{CAST[who].name}, with feelings</h1>
          <p className={cn('mt-3 max-w-2xl text-[16px]', sub)}>Poke it once, three, six, nine times. Move your pointer (or tap anywhere on a phone) and it looks. Leave it alone: drowsy at 30 seconds, asleep at a minute. The same reaction a fourth time is shorter and silent.</p>
        </div>
        <div className={cn('flex flex-col items-center gap-6 rounded-3xl p-8 sm:flex-row sm:items-center', tile)}>
          <CastMascot ref={big} character={who} mood={base} size={240} />
          <div className="flex flex-col gap-3">
            <p className={cn('text-[14px]', sub)}>Base mood (what the screen sets):</p>
            <div className="flex flex-wrap gap-2">
              {(['idle', 'working', 'listening', 'worried'] as Mood[]).map((x) => (
                <button key={x} type="button" onClick={() => setBase(x)} className={cn('rounded-full px-3 py-1.5 text-[13px]', base === x ? 'bg-[#8B74FF] text-white' : night ? 'bg-white/[0.07]' : 'bg-[#1B1530]/[0.06]')}>{x}</button>
              ))}
            </div>
            <p className={cn('mt-2 text-[14px]', sub)}>One-off reactions (what events trigger):</p>
            <div className="flex flex-wrap gap-2">
              {(['wave', 'happy', 'celebrate', 'surprised', 'wink', 'love', 'giggle', 'dizzy', 'shrug', 'shy', 'nervous', 'hide', 'smirk'] as Mood[]).map((x) => (
                <button key={x} type="button" onClick={() => big.current?.react(x, x === 'celebrate' ? 'woo!' : undefined, 1600)} className={cn('rounded-full px-3 py-1.5 text-[13px]', night ? 'bg-white/[0.07] hover:bg-white/[0.12]' : 'bg-[#1B1530]/[0.06] hover:bg-[#1B1530]/10')}>{x}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {MOODS.map((x) => (
            <div key={x} className={cn('flex flex-col items-center gap-1 rounded-2xl p-3', tile)}>
              <CastMascot character={who} mood={x} size={110} sleepAfter={0} />
              <span className={cn('text-[12px]', sub)}>{x}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <p className={cn('eyebrow', sub)}>Buttons</p>
          <h2 className="mt-2 text-[26px]" style={{ fontWeight: 470 }}>Made for thumbs</h2>
          <p className={cn('mt-2 max-w-2xl text-[15px]', sub)}>No hover on a phone, so the press is the feedback: the face sinks into its edge and springs back. Android buzzes lightly; iOS browsers can’t.</p>
        </div>
        <div className={cn('flex flex-wrap items-center gap-4 rounded-3xl p-6', tile)}>
          <PushButton tone="primary">Primary</PushButton>
          <PushButton tone="light">Light</PushButton>
          <PushButton tone="dark">Dark</PushButton>
          <PushButton tone="quiet">Quiet</PushButton>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative isolate flex min-h-40 items-center justify-center overflow-hidden rounded-3xl">
            <Backdrop kind="aurora" className="absolute inset-0 -z-10" />
            <RainbowButton on="dark">Let’s begin</RainbowButton>
          </div>
          <div className="relative isolate flex min-h-40 items-center justify-center overflow-hidden rounded-3xl ring-1 ring-[#e7e6f2]">
            <Backdrop kind="paper" className="absolute inset-0 -z-10" />
            <RainbowButton on="light">Let’s begin</RainbowButton>
          </div>
        </div>
        <div className={cn('rounded-3xl p-6', tile)}>
          <HoldButton tone={night ? 'primary' : 'dark'} onDone={() => undefined} doneLabel={<>🤝 Deal.</>}>Press and hold: Deal</HoldButton>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <p className={cn('eyebrow', sub)}>Backgrounds</p>
          <h2 className="mt-2 text-[26px]" style={{ fontWeight: 470 }}>Three to choose from</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {([['aurora', 'Glow + grain (night), brightens as you go'], ['spotlight', 'Spotlight grid (night), follows the mascot on phones'], ['paper', 'Graph paper (day)']] as [BackdropKind, string][]).map(([k, label]) => (
            <div key={k} className="flex flex-col gap-2">
              <div className="relative isolate h-44 overflow-hidden rounded-3xl ring-1 ring-black/5"><Backdrop kind={k} className="absolute inset-0 -z-10" /></div>
              <span className={cn('text-[13px]', sub)}>{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ---------- the lab's own controls ---------- */

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-black/5 p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn('flex-1 rounded-full px-3 py-1.5 text-[13px] transition-colors', value === v ? 'bg-white text-[#1B1530] shadow-sm' : 'text-[#554e7b]')}>{l}</button>
      ))}
    </div>
  )
}

function Controls(p: { who: CastName; setWho: (c: CastName) => void; theme: Theme; setTheme: (t: Theme) => void; bg: BackdropKind; setBg: (b: BackdropKind) => void; btn: Btn; setBtn: (b: Btn) => void; view: 'flow' | 'kit'; setView: (v: 'flow' | 'kit') => void; screen: Screen; setScreen: (s: Screen) => void; font: Font; setFont: (f: Font) => void; quiet: boolean; setQuiet: (q: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const night = p.theme === 'night'
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="w-[min(92vw,340px)] rounded-3xl bg-white p-4 text-[#1B1530] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className="mb-3 flex items-center justify-between"><p className="text-[14px]" style={{ fontWeight: 560 }}>Onboarding lab</p><button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full hover:bg-black/5" aria-label="Close"><X className="size-4" /></button></div>
            <div className="flex flex-col gap-3 text-[12px] text-[#554e7b]">
              <label className="flex flex-col gap-1.5">Show<Seg value={p.view} options={[['flow', 'Flow'], ['kit', 'Kit']]} onChange={p.setView} /></label>
              <label className="flex flex-col gap-1.5">Theme<Seg value={p.theme} options={[['night', 'Night'], ['day', 'Day (white)']]} onChange={p.setTheme} /></label>
              <label className="flex flex-col gap-1.5">Background
                <Seg value={p.bg} options={night ? [['clouds', 'Clouds'], ['aurora', 'Glow'], ['spotlight', 'Spotlight'], ['plain-night', 'Plain']] : [['clouds-day', 'Clouds'], ['paper', 'Graph'], ['plain-day', 'Plain']]} onChange={p.setBg} />
              </label>
              <label className="flex flex-col gap-1.5">Main button<Seg value={p.btn} options={[['push', 'Press-down'], ['rainbow', 'Rainbow']]} onChange={p.setBtn} /></label>
              <label className="flex flex-col gap-1.5">Headlines<Seg value={p.font} options={[['inter', 'Inter'], ['bricolage', 'Bricolage'], ['fraunces', 'Fraunces']]} onChange={p.setFont} /></label>
              <label className="flex flex-col gap-1.5">Character
                <select value={p.who} onChange={(e) => p.setWho(e.target.value as CastName)} className="h-9 rounded-full bg-black/5 px-3 text-[13px] text-[#1B1530]">
                  {CAST_NAMES.map((c) => <option key={c} value={c}>{CAST[c].name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">Mascot<Seg value={p.quiet ? 'quiet' : 'lively'} options={[['lively', 'Lively'], ['quiet', 'Quiet']]} onChange={(v) => p.setQuiet(v === 'quiet')} /></label>
              {p.view === 'flow' ? (
                <label className="flex flex-col gap-1.5">Screen
                  <div className="grid grid-cols-7 gap-1">{SCREENS.map((s, k) => <button key={s} type="button" onClick={() => p.setScreen(s)} className={cn('rounded-lg py-1.5 text-[13px]', p.screen === s ? 'bg-[#6B52F0] text-white' : 'bg-black/5')} title={s}>{k + 1}</button>)}</div>
                </label>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[14px] text-[#1B1530] shadow-[0_8px_24px_rgba(0,0,0,0.25)]" style={{ fontWeight: 520 }}>
        <SlidersHorizontal className="size-4" /> Lab
      </button>
    </div>
  )
}
