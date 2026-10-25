import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { identityPatch, justConnected, linkedInMe, startConnect, type LinkedInMe } from '@/lib/connect'
import type { Destination, Kpi, Screen, Step } from '@/lib/types'
import { GOALS, KPI_LABEL, cleanLink, destReady, kpiOrder } from '@/lib/world'
import type { MascotHandle, Mood } from '@/components/cast/CastMascot'
import { HoldButton } from '@/components/Press'
import { DestinationForm } from '@/components/DestinationForm'
import { usePendingIdentity } from '@/components/Identity'
import { useTeammateBusy } from '@/components/PixelGrid'
import { Avatar } from '@/views/Engage'
import { cn } from '@/lib/utils'
import { Actions, CHAPTERS, Card, FlowProvider, Later, MascotProvider, Pill, Primary, Quiet, SCREENS, Spool, SpoolProvider, Tile, Title, inputClass, screenOf, useFlow, useMascot } from './flow'
import { Reveal, SignInStep, WorldInputs } from './WorldSteps'
import { FirstPost, Stand, Week } from './StartSteps'

/* Onboarding: ten screens in four chapters (you, what you want, your world, your start). It
   reads first and asks later, pays the person back as it goes (their world, where they stand,
   a first post), and ends on their first week. Nothing waits on the slow work: the world map,
   the numbers and the first ideas run in the background while they carry on. */

type Patch = Record<string, unknown>

export function Onboarding() {
  const pod = usePod()
  const p = pod.profile
  const [local, setLocal] = useState<Screen | null>(null)
  const screen = local ?? screenOf(p)
  const signedIn = p?.browser_status === 'signed_in'
  // Already signed in to LinkedIn: no need to ask.
  const order = SCREENS.filter((s) => s !== 'signin' || !signedIn || screen === 'signin')
  const index = Math.max(0, order.indexOf(screen))
  const skipped = (p?.skipped || []) as Step[]

  const save = (patch: Patch) => (p ? pod.update('profile', p.id, patch) : Promise.resolve())
  const go = (s: Screen, patch: Patch = {}) => {
    setLocal(s)
    window.scrollTo({ top: 0 })
    void save({ onboarding_screen: s, ...patch })
  }
  const next = (patch: Patch = {}) => {
    const answeredLater = screen === 'dest' && skipped.includes('dest') ? { skipped: skipped.filter((x) => x !== 'dest') } : {}
    go(order[Math.min(index + 1, order.length - 1)], { ...answeredLater, ...patch })
  }
  const skip = () => go(order[index + 1], { skipped: Array.from(new Set([...skipped, screen as Step])) })
  const back = () => index > 0 && go(order[index - 1])
  const finish = (patch: Patch = {}) => save({ ...patch, onboarding_screen: 'done', onboarding_step: 'done' })

  // Spool, at the top of every screen: a base mood, quick reactions and eyes on a field.
  const mascot = useRef<MascotHandle>(null)
  const [mood, setMood] = useState<Mood | null>(null)
  const [lookAt, setLookAt] = useState<RefObject<HTMLElement | null> | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef(0)
  const busy = useTeammateBusy()
  const api = useMemo(() => ({
    react: (m: Mood, say?: string, ms = 1400) => {
      mascot.current?.react(m, undefined, ms)
      if (!say) return
      window.clearTimeout(flashTimer.current)
      setFlash(say)
      flashTimer.current = window.setTimeout(() => setFlash(null), Math.max(ms, 1800))
    },
    mood: (m: Mood) => setMood(m === 'idle' ? null : m),
    look: (r: RefObject<HTMLElement | null> | null) => setLookAt(r),
  }), [])
  useEffect(() => {
    setMood(null)
    setLookAt(null)
    setFlash(null)
    if (screen !== 'profile') return
    const t = window.setTimeout(() => mascot.current?.react('wave', undefined, 2200), 500)
    return () => window.clearTimeout(t)
  }, [screen])

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 sm:pt-8">
        <header className="flex items-center gap-3">
          <button type="button" onClick={back} disabled={index === 0} className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line transition hover:text-ink disabled:invisible" aria-label="Back">
            <ArrowLeft className="size-[18px]" />
          </button>
          <Progress screen={screen} order={order} />
        </header>
        <WorkChip screen={screen} />
        {screen !== 'profile' ? <Pending onNotMe={() => go('profile', { linkedin_name: null, headline: null, photo_url: null })} /> : null}
        <MascotProvider value={api}>
          <SpoolProvider value={{ ref: mascot, mood: mood ?? (busy ? 'working' : 'idle'), lookAt, flash }}>
            <FlowProvider value={{ compact: false, skip: screen === 'dest' ? skip : undefined }}>
              <AnimatePresence mode="wait">
                <motion.main key={screen} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-5">
                  {screen === 'profile' && <ProfileScreen onNext={next} />}
                  {screen === 'goals' && <Goals onNext={next} />}
                  {screen === 'dest' && <DestinationStep onNext={next} />}
                  {screen === 'deal' && <Deal onNext={next} />}
                  {screen === 'world' && <WorldInputs onNext={next} />}
                  {screen === 'signin' && <SignInStep onNext={next} />}
                  {screen === 'reveal' && <Reveal onNext={next} />}
                  {screen === 'stand' && <Stand onNext={next} />}
                  {screen === 'first' && <FirstPost onNext={next} />}
                  {screen === 'week' && <Week onFinish={finish} />}
                </motion.main>
              </AnimatePresence>
            </FlowProvider>
          </SpoolProvider>
        </MascotProvider>
      </div>
    </div>
  )
}

/* ---------- shared bits ---------- */

/** Four chapters, each a bar that fills as you go. Names show from tablet width up. */
function Progress({ screen, order }: { screen: Screen; order: Screen[] }) {
  const at = CHAPTERS.findIndex((c) => c.screens.includes(screen))
  return (
    <div className="grid flex-1 grid-cols-4 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={at + 1} aria-label={`Chapter ${at + 1} of 4: ${CHAPTERS[at]?.name}`}>
      {CHAPTERS.map((c, i) => {
        const mine = c.screens.filter((s) => order.includes(s))
        const pct = i < at ? 100 : i > at ? 0 : Math.round(((mine.indexOf(screen) + 0.5) / mine.length) * 100)
        return (
          <div key={c.name} className="flex flex-col gap-1.5">
            <span className="block h-[5px] overflow-hidden rounded-pill bg-ink/10"><motion.span className="block h-full rounded-pill bg-ink" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} /></span>
            <span className={cn('hidden text-[11px] sm:block', i === at ? 'text-ink' : 'text-slate')} style={{ fontWeight: 560 }}>{c.name}</span>
          </div>
        )
      })}
    </div>
  )
}

/** What Spool is doing in the background right now, in one line. */
function WorkChip({ screen }: { screen: Screen }) {
  const { activity } = usePod()
  const { looking } = usePendingIdentity()
  const recent = activity.find((a) => ['learning', 'world', 'engage', 'post', 'research', 'voice'].includes(a.skill) && a.detail && a.created_at && Date.now() - new Date(a.created_at).getTime() < 10 * 60 * 1000)
  const text = looking && screen !== 'profile' ? 'Looking you up' : recent?.detail
  if (!text) return null
  return (
    <p className="-mt-1 flex min-w-0 items-center gap-2 text-[12.5px] text-slate" aria-live="polite">
      <span className="size-[7px] shrink-0 animate-pulse rounded-full bg-[#3fb37f]" aria-hidden />
      <span className="truncate">{text.replace(/[.…]+$/, '')}…</span>
    </p>
  )
}

/** Found in the background after they moved on: confirm it here. */
function Pending({ onNotMe }: { onNotMe: () => void }) {
  const pod = usePod()
  const p = pod.profile
  const { pending } = usePendingIdentity()
  return (
    <AnimatePresence>
      {pending && p ? (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
          <Avatar name={p.linkedin_name} photo={p.photo_url} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-2">Found you. Is this you?</p>
            <p className="truncate text-[15px] text-ink" style={{ fontWeight: 560 }}>{p.linkedin_name}</p>
            {p.headline ? <p className="truncate text-[13px] text-ink-2">{p.headline}</p> : null}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => void pod.update('profile', p.id, { profile_confirmed: true, first_name: p.first_name || p.linkedin_name?.split(' ')[0] || null })} className="h-9 rounded-pill bg-ink px-4 text-[14px] text-white">That’s me</button>
            <button type="button" onClick={onNotMe} className="h-9 rounded-pill px-3 text-[14px] text-ink-2 hover:bg-ink/5">Not me</button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/* ---------- 1. Your LinkedIn ---------- */

/* Paste the link and press Find me: the lookup runs in the background and "Is this you?"
   appears here when it lands (usually under a minute). They can carry on meanwhile; the
   question then waits at the top of the next screens. Connecting LinkedIn is the quick way. */
function ProfileScreen({ onNext }: { onNext: (patch?: Patch) => void }) {
  const pod = usePod()
  const p = pod.profile
  const chat = useChat()
  const mascot = useMascot()
  const field = useRef<HTMLInputElement>(null)
  const [me, setMe] = useState<LinkedInMe | null>(null)
  const [url, setUrl] = useState((p?.linkedin_url || '').replace(/^https?:\/\/(www\.)?/, ''))
  const [notMe, setNotMe] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let live = true
    justConnected('linkedin')
    void linkedInMe().then((r) => { if (live && r.connected && r.name) setMe(r) })
    return () => { live = false }
  }, [])

  const looking = !notMe && !me && !!p?.linkedin_url && !p.linkedin_name && !p.profile_confirmed
  useWaitFor(looking, ['profile'], 3000, 120000)
  const found = notMe ? null : me ? { name: me.name || 'You', headline: me.headline, photo: me.photo_url } : p?.linkedin_name ? { name: p.linkedin_name, headline: p.headline, photo: p.photo_url } : null
  const valid = /linkedin\.com\/in\/[^/?#\s]+/i.test(url)

  useEffect(() => { if (found) mascot.react('happy', undefined, 1200) }, [!!found]) // eslint-disable-line react-hooks/exhaustive-deps

  const find = () => {
    if (!valid || !p) return
    const clean = 'https://' + url.trim().replace(/^https?:\/\//, '')
    setNotMe(false)
    void pod.update('profile', p.id, { linkedin_url: clean, linkedin_name: null, headline: null, photo_url: null, profile_confirmed: false })
    void chat.task(`[onboarding] find-profile ${clean}`)
  }
  const confirm = () => onNext(me ? { ...identityPatch(me), profile_confirmed: true } : { profile_confirmed: true, first_name: p?.first_name || p?.linkedin_name?.split(' ')[0] || null })
  const notThem = () => {
    setNotMe(true)
    setMe(null)
    if (p) void pod.update('profile', p.id, { linkedin_name: null, headline: null, photo_url: null, profile_confirmed: false })
    window.setTimeout(() => field.current?.focus(), 50)
  }
  const connect = async () => {
    setConnecting(true)
    const e = await startConnect('linkedin')
    if (e) setErr(e)
    setConnecting(false)
  }
  const first = p?.first_name || p?.display_name?.split(' ')[0]

  return (
    <>
      <Spool>{found ? 'Everything I write starts from this profile, so it matters that it’s you.' : `Hi${first ? ` ${first}` : ''}, I’m Spool. I read first and ask later, so this takes about five minutes.`}</Spool>
      <Title>Paste your LinkedIn link</Title>
      <form onSubmit={(e) => { e.preventDefault(); find() }}>
        <label htmlFor="li-url" className="sr-only">Your LinkedIn profile link</label>
        <input
          id="li-url"
          ref={field}
          value={url}
          onChange={(e) => {
            const was = valid
            setUrl(e.target.value)
            if (!was && /linkedin\.com\/in\/[^/?#\s]+/i.test(e.target.value)) mascot.react('happy', undefined, 900)
          }}
          onFocus={() => { mascot.mood('listening'); mascot.look(field) }}
          onBlur={() => { mascot.mood('idle'); mascot.look(null) }}
          placeholder="linkedin.com/in/your-name"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          className={inputClass}
        />
      </form>
      {found ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
          <p className="text-[15px] text-ink" style={{ fontWeight: 560 }}>Is this you?</p>
          <Card className="flex items-center gap-4">
            <Avatar name={found.name} photo={found.photo} size={56} />
            <div className="min-w-0">
              <p className="text-[16px] text-ink" style={{ fontWeight: 560 }}>{found.name}</p>
              {found.headline ? <p className="text-[14px] leading-snug text-ink-2">{found.headline}</p> : null}
              {me ? <p className="mt-1 text-[12.5px] text-slate">From your LinkedIn connection</p> : null}
            </div>
          </Card>
        </motion.div>
      ) : looking ? (
        <Card className="flex items-center gap-3">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-[#3fb37f]" aria-hidden />
          <p className="text-[14.5px] text-ink-2">Looking you up. It usually takes under a minute, and you can carry on meanwhile.</p>
        </Card>
      ) : null}
      <Actions note={!found && !looking ? <>Or <button type="button" onClick={() => void connect()} disabled={connecting} className="text-ink underline underline-offset-4">{connecting ? 'opening LinkedIn…' : 'connect LinkedIn'}</button> for your exact profile in seconds.{err ? <span className="mt-1 block text-[#8a4b00]">{err}</span> : null}</> : undefined}>
        {found ? (
          <>
            <Primary onClick={confirm}>That’s me</Primary>
            <Quiet onClick={notThem}>Not me</Quiet>
          </>
        ) : looking ? (
          <Primary onClick={() => onNext()}>Keep going while I look</Primary>
        ) : (
          <Primary disabled={!valid} onClick={find}>Find me</Primary>
        )}
      </Actions>
    </>
  )
}

/* ---------- 2. What LinkedIn should do for you ---------- */

/** Up to two goals; what gets counted first follows from them, and a tap moves one to the front. */
export function Goals({ onNext }: { onNext: (patch: Patch) => void }) {
  const { profile: p } = usePod()
  const { compact } = useFlow()
  const mascot = useMascot()
  const [picked, setPicked] = useState<string[]>(((p?.goals as string[]) || []).filter((g) => GOALS.some((x) => x.key === g)).slice(0, 2))
  const [kpis, setKpis] = useState<Kpi[]>(() => (p?.kpi_order?.length ? p.kpi_order : kpiOrder(picked)))
  const toggle = (k: string) => {
    const on = !picked.includes(k)
    const nextPicked = !on ? picked.filter((x) => x !== k) : picked.length < 2 ? [...picked, k] : [picked[1], k]
    setPicked(nextPicked)
    setKpis(kpiOrder(nextPicked))
    if (on) mascot.react('happy', undefined, 900)
  }
  const promote = (k: Kpi) => setKpis([k, ...kpis.filter((x) => x !== k)])
  return (
    <>
      <Spool>{p?.profile_confirmed ? 'While you pick, I’m reading your posts in the background.' : 'Every post I write will point at what you pick here.'}</Spool>
      <Title sub="Up to two.">What should LinkedIn do for you?</Title>
      <div className={cn('grid grid-cols-2 gap-2.5', !compact && 'sm:grid-cols-3')}>
        {GOALS.map((g) => <Tile key={g.key} on={picked.includes(g.key)} onClick={() => toggle(g.key)} emoji={g.emoji} title={g.label} />)}
      </div>
      <AnimatePresence initial={false}>
        {picked.length ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <p className="text-[14.5px] text-ink"><span style={{ fontWeight: 560 }}>So this is what I’ll count, in this order.</span> <span className="text-ink-2">Tap one to count it first.</span></p>
              <ol className="mt-2.5 flex flex-wrap gap-1.5">
                {kpis.map((k, i) => (
                  <li key={k}>
                    <motion.button layout type="button" onClick={() => promote(k)} className="min-h-9 rounded-pill bg-canvas px-3 text-[13.5px] text-ink ring-1 ring-line hover:ring-ink/30" style={{ fontWeight: 520 }} aria-label={`Count ${KPI_LABEL[k]} first`}>
                      <span className="tabular text-slate">{i + 1}</span> · {KPI_LABEL[k]}
                    </motion.button>
                  </li>
                ))}
              </ol>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Actions>
        <Primary disabled={!picked.length} onClick={() => onNext({ goals: picked, goal: GOALS.find((g) => g.key === picked[0])?.goal ?? null, kpi_order: kpis })}>{compact ? 'Save' : 'Continue'}</Primary>
        {compact ? <Later /> : null}
      </Actions>
    </>
  )
}

/* ---------- 3. Where people go next ---------- */

/** Each choice asks for its link and one follow-up; "Nothing yet" asks for nothing. */
export function DestinationStep({ onNext }: { onNext: (patch: Patch) => void }) {
  const { profile: p } = usePod()
  const { compact } = useFlow()
  const guess = p?.destination?.guess ? p.destination.kind : null
  const [d, setD] = useState<Destination | null>(p?.destination ? { ...p.destination } : null)
  const save = () => d && onNext({ destination: { kind: d.kind, link: d.kind === 'none' ? null : cleanLink(d.link || ''), detail: d.detail || null, guess: false } })
  return (
    <>
      <Spool>Most posts end without telling people what to do next. Yours won’t.{guess ? ' My guess comes from your website.' : ''}</Spool>
      <Title>Where should people go next?</Title>
      <DestinationForm value={d} onChange={setD} guessed={guess} compact={compact} />
      <Actions>
        <Primary disabled={!destReady(d)} onClick={save}>{compact ? 'Save' : 'Continue'}</Primary>
        <Later />
      </Actions>
    </>
  )
}

/* ---------- 4. Worries, then the deal ---------- */

const WORRIES = [
  { key: 'ai', label: 'Sounding like AI', emoji: '✍️', title: 'Your voice, not a bot’s', text: 'I learn from your own posts and every edit you make. No buzzwords, no walls of hashtags, no em dashes.' },
  { key: 'restricted', label: 'My account getting restricted', emoji: '🛡️', title: 'Slow, capped, and I stop at a warning', text: 'A few comments and likes a day at most, minutes apart, only in your working hours. At the first warning I stop everything and tell you.' },
  { key: 'bothering', label: 'Bothering people', emoji: '🙅', title: 'Nothing goes out without your yes', text: 'Every comment, message and invitation waits for your approval, word for word.' },
  { key: 'time', label: 'It eating my time', emoji: '⏱️', title: 'About 10 minutes a day', text: 'You approve in one go. The finding, drafting and tracking happen while you work.' },
] as const

/** Tap a worry and its remedy appears. */
function WorryPicker({ picked, setPicked }: { picked: string[]; setPicked: (v: string[]) => void }) {
  const mascot = useMascot()
  const shown = WORRIES.filter((w) => picked.includes(w.key))
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {WORRIES.map((w) => (
          <Pill key={w.key} on={picked.includes(w.key)} onClick={() => { if (!picked.includes(w.key)) mascot.react('candid', undefined, 900); setPicked(picked.includes(w.key) ? picked.filter((x) => x !== w.key) : [...picked, w.key]) }}>{w.label}</Pill>
        ))}
      </div>
      {shown.length ? (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {shown.map((w) => (
              <motion.li key={w.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <span className="text-[20px] leading-7" aria-hidden>{w.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] text-ink" style={{ fontWeight: 560 }}>{w.title}</span>
                  <span className="block text-[14px] leading-snug text-ink-2">{w.text}</span>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="text-[13px] text-slate">Nothing worrying? Then it’s just the deal: you approve, I do the rest.</p>
      )}
    </>
  )
}

function Deal({ onNext }: { onNext: (patch: Patch) => void }) {
  const { profile } = usePod()
  const mascot = useMascot()
  const [picked, setPicked] = useState<string[]>(((profile?.worries as string[]) || []).filter((k) => WORRIES.some((w) => w.key === k)))
  return (
    <>
      <Spool>Tap anything that worries you. I’ll show you how I handle it.</Spool>
      <Title>Before I touch your account</Title>
      <WorryPicker picked={picked} setPicked={setPicked} />
      <Actions>
        <HoldButton
          tone="dark"
          ms={1100}
          onProgress={(v) => mascot.mood(v > 0 && v < 1 ? 'nervous' : 'idle')}
          onDone={() => {
            mascot.react('celebrate', 'Deal. I’ll bring the coffee.', 2000)
            window.setTimeout(() => onNext({ worries: picked, agreed_at: new Date().toISOString() }), 1400)
          }}
          doneLabel={<>🤝 Deal</>}
        >
          Press and hold: deal
        </HoldButton>
      </Actions>
    </>
  )
}

/** The worries on their own, as a quick question in the app. */
export function Worries({ onNext }: { onNext: (patch: Patch) => void }) {
  const { profile } = usePod()
  const [picked, setPicked] = useState<string[]>(((profile?.worries as string[]) || []).filter((k) => WORRIES.some((w) => w.key === k)))
  return (
    <>
      <Title sub="Pick any that apply. I’d rather know.">What worries you about doing this with help?</Title>
      <WorryPicker picked={picked} setPicked={setPicked} />
      <Actions>
        <Primary onClick={() => onNext({ worries: picked })}>{picked.length ? 'Good, save' : 'None of these'}</Primary>
        <Later />
      </Actions>
    </>
  )
}
