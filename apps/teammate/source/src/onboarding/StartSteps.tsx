import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Lock } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { SKILLS, defaultPlan } from '@/lib/skills'
import { nextSlot } from '@/lib/time'
import type { Draft, EngageRun, Kpi, Profile } from '@/lib/types'
import { KPI_LABEL, kpiOrder } from '@/lib/world'
import { DEFAULT_RUNS } from '@/views/Engage'
import { PostPreview } from '@/views/Today'
import { cn } from '@/lib/utils'
import { Actions, Card, Later, Pill, Primary, Quiet, Spool, Tile, Title, useFlow, useMascot } from './flow'
import { useStartWork } from './WorldSteps'

/* The "your start" chapter: where they stand today (numbers in the order they care about,
   what worked, two fixes), a first post (three ideas, a draft, and a reaction that sets
   tone and voice), and the first week with their 10-minute moment. Finishing switches on
   what the week shows, and nothing else. */

type Patch = Record<string, unknown>

/* ---------- 8. Where you stand ---------- */

export function Stand({ onNext }: { onNext: (patch?: Patch) => void }) {
  const { profile: p } = usePod()
  const s = p?.stats || null
  const signedIn = p?.browser_status === 'signed_in'
  const order: Kpi[] = p?.kpi_order?.length ? p.kpi_order : kpiOrder((p?.goals as string[]) || [])
  const value: Partial<Record<Kpi, number | null | undefined>> = { followers: s?.followers, profile_visits: s?.profile_views_week, impressions: s?.impressions_week }
  const label: Partial<Record<Kpi, string>> = { followers: 'followers', profile_visits: 'profile visits a week', impressions: 'impressions a week' }
  // the three numbers LinkedIn has, in the order they care about; hidden ones show as a dash
  const nums = Array.from(new Set<Kpi>([...order, 'profile_visits', 'impressions', 'followers'])).filter((k) => k in value)
  const reading = !!p?.profile_confirmed && p.learning_status !== 'done' && p.learning_status !== 'failed'
  const hidden = s?.profile_views_week == null && s?.impressions_week == null
  useWaitFor(reading || (signedIn && hidden), ['profile'], 6000, 10 * 60 * 1000)
  const fixes = (s?.fixes || []).filter(Boolean).slice(0, 2)
  return (
    <>
      <Spool>A starting line, not a verdict. We’ll measure everything from here.</Spool>
      <Title>Where you stand</Title>
      <div className="grid grid-cols-3 gap-2">
        {nums.map((k, i) => (
          <div key={k} className="min-w-0 rounded-2xl bg-surface px-3 py-3 ring-1 ring-line sm:px-3.5">
            <p className="text-[10.5px] tabular text-slate" style={{ fontWeight: 640 }}>{i + 1}</p>
            {value[k] == null ? (
              <p className="flex h-[29px] items-center gap-1.5 text-[14px] text-slate sm:h-[34px]">{signedIn ? <span className="size-2 animate-pulse rounded-full bg-[#3fb37f]" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}{signedIn ? 'reading' : 'hidden'}</p>
            ) : (
              <p className="text-[22px] leading-tight tabular text-ink sm:text-[26px]" style={{ fontFamily: 'var(--font-display)', fontWeight: 560 }}>{(value[k] as number).toLocaleString()}</p>
            )}
            <p className="text-[12.5px] leading-snug text-ink-2">{label[k] || KPI_LABEL[k]}</p>
          </div>
        ))}
      </div>
      {hidden ? (
        <p className="-mt-2 flex items-start gap-2 px-1 text-[13px] leading-snug text-ink-2">
          {signedIn ? <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-[#3fb37f]" aria-hidden /> : null}
          {signedIn ? 'Reading your profile visits and impressions now. If they land after you move on, they’ll be on Home.' : 'LinkedIn shows profile visits and impressions only to you. Sign in from Personalization, Connections, and I’ll read them every day.'}
        </p>
      ) : null}
      {s?.best?.title ? (
        <Card>
          <p className="text-[12.5px] text-slate">What worked</p>
          <p className="mt-0.5 text-[15px] leading-snug text-ink" style={{ fontWeight: 560 }}>{s.best.title}</p>
          {s.best.numbers ? <p className="text-[13.5px] text-ink-2">{s.best.numbers}</p> : null}
          {s.best.why ? <p className="mt-1 text-[14px] leading-snug text-ink-2">{s.best.why}</p> : null}
        </Card>
      ) : null}
      {fixes.length ? (
        <Card className="flex flex-col gap-2">
          <p className="text-[12.5px] text-slate">{fixes.length === 1 ? 'One fix I’d make first' : 'Two fixes I’d make first'}</p>
          {fixes.map((f) => (
            <p key={f} className="flex items-start gap-2.5 rounded-xl bg-[#fff7ef] px-3 py-2.5 text-[14px] leading-snug text-ink"><span aria-hidden>🔧</span><span>{f}</span></p>
          ))}
        </Card>
      ) : null}
      {!s?.best?.title && !fixes.length && reading ? (
        <Card className="flex items-center gap-3">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-[#3fb37f]" aria-hidden />
          <p className="text-[14.5px] text-ink-2">Still reading your profile and posts. What worked, and what I’d fix first, lands on Home when it’s ready.</p>
        </Card>
      ) : null}
      <Actions>
        <Primary onClick={() => onNext()}>Let’s write something</Primary>
      </Actions>
    </>
  )
}

/* ---------- 9. Your first post ---------- */

const KINDS: [string, string][] = [['From your world', '🔥'], ['Like your best post', '⭐'], ['From your work', '🛠️']]
/** The idea's kind is the start of its source ("From your world · …"); otherwise by position. */
function kindOf(d: Draft, i: number): [string, string] {
  const head = (d.source || '').split(' · ')[0].trim().toLowerCase()
  return KINDS.find(([l]) => head === l.toLowerCase()) || KINDS[i % KINDS.length]
}
const REACTIONS = [
  { key: 'Sounds like me', mood: 'love', line: 'Noted. I’ll keep this voice and learn from every edit.', done: '' },
  { key: 'Too polished', mood: 'candid', line: 'Plainer and shorter, then. Rewriting it now.', done: 'Plainer now. Better?', patch: { tone: 'candid' } },
  { key: 'Too blunt', mood: 'shy', line: 'A little warmer, same point. Softening it now.', done: 'Warmer now, same point. Better?', patch: { tone: 'polite' } },
  { key: 'Not me at all', mood: 'worried', line: 'Fair. Tell me in one line what’s off.', done: 'Rewritten your way. Closer?' },
] as const

export function FirstPost({ onNext }: { onNext: (patch?: Patch) => void }) {
  const pod = usePod()
  const p = pod.profile
  const chat = useChat()
  const mascot = useMascot()
  const work = useStartWork()
  const [chosen, setChosen] = useState<string | null>((p?.first_post_choice || '').split(' ')[0] || null)
  const [reaction, setReaction] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [rewriting, setRewriting] = useState<number | null>(null)
  const [revised, setRevised] = useState(false)
  const started = useRef(Date.now())
  const draft = chosen ? pod.drafts.find((d) => d.id === chosen) || null : null
  const ideas = pod.drafts.filter((d) => d.status === 'idea').sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 3)
  const writing = !!draft && !draft.body
  const rewritten = !!draft && rewriting != null && new Date(draft.updated_at || 0).getTime() > rewriting
  const waiting = (!draft && ideas.length < 3) || writing || (rewriting != null && !rewritten)
  useWaitFor(waiting, ['drafts'], 4000, 10 * 60 * 1000)
  useEffect(() => { if (!ideas.length && !draft) work.ideas() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rewritten) { setRewriting(null); setRevised(true); mascot.react('happy', undefined, 1000) } }, [rewritten]) // eslint-disable-line react-hooks/exhaustive-deps
  const slow = Date.now() - started.current > 2 * 60 * 1000

  const pick = (d: Draft) => {
    setChosen(d.id)
    setReaction(null)
    if (p) void pod.update('profile', p.id, { first_post_choice: d.id })
    if (!d.body) void chat.task(`[onboarding] draft ${d.id}`)
    mascot.mood('working')
  }
  const react = (r: (typeof REACTIONS)[number]) => {
    setReaction(r.key)
    setRevised(false)
    mascot.react(r.mood, r.line, 2600)
    if ('patch' in r && p) void pod.update('profile', p.id, r.patch)
    if (r.key === 'Sounds like me' && p && !p.voice_mode) void pod.update('profile', p.id, { voice_mode: 'mine' })
    if (draft && (r.key === 'Too polished' || r.key === 'Too blunt')) {
      setRewriting(Date.now())
      void chat.task(`[onboarding] react ${draft.id} ${r.key}`)
    }
  }
  const rewrite = () => {
    if (!draft || !note.trim()) return
    setRewriting(Date.now())
    void chat.task(`[onboarding] react ${draft.id} Not me at all: ${note.trim()}`)
    setNote('')
  }

  const line = !draft
    ? ideas.length ? 'One of these rides something moving in your world right now.' : 'Writing three ideas from your world and your best posts.'
    : writing ? 'Writing it in your voice. Give me a moment.' : rewriting != null && !rewritten ? 'Rewriting it the way you said.' : reaction ? (revised && REACTIONS.find((r) => r.key === reaction)!.done) || REACTIONS.find((r) => r.key === reaction)!.line : 'Read it out loud. Does it sound like you?'

  return (
    <>
      <Spool>{line}</Spool>
      <Title>Your first post</Title>
      {!draft ? (
        <div className="flex flex-col gap-2">
          {ideas.map((d, i) => {
            const [kind, emoji] = kindOf(d, i)
            return (
              <motion.button key={d.id} type="button" onClick={() => pick(d)} whileTap={{ scale: 0.98 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex w-full items-start gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left ring-1 ring-line transition-shadow hover:ring-ink/30">
                <span className="text-[20px] leading-7" aria-hidden>{emoji}</span>
                <span className="min-w-0">
                  <span className="block text-[12px] text-slate" style={{ fontWeight: 600 }}>{kind}</span>
                  <span className="block text-[15px] leading-snug text-ink" style={{ fontWeight: 560 }}>{d.title}</span>
                  {d.why_now ? <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ink-2">{d.why_now}</span> : null}
                </span>
              </motion.button>
            )
          })}
          {Array.from({ length: Math.max(0, 3 - ideas.length) }).map((_, i) => (
            <div key={`s${i}`} className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-line" aria-hidden>
              <span className="mt-1 size-5 animate-pulse rounded-full bg-ink/8" />
              <span className="flex flex-1 flex-col gap-2 pt-1"><span className="h-2.5 w-24 animate-pulse rounded-pill bg-ink/8" /><span className="h-3.5 w-4/5 animate-pulse rounded-pill bg-ink/8" /></span>
            </div>
          ))}
          {ideas.length < 3 && slow ? <p className="text-[13px] text-slate">Taking longer than usual. Carry on if you like: your first post will be waiting on Home.</p> : null}
        </div>
      ) : (
        <>
          <button type="button" onClick={() => { setChosen(null); setReaction(null); if (p) void pod.update('profile', p.id, { first_post_choice: null }) }} className="-mt-2 inline-flex w-fit items-center gap-1.5 text-[14px] text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" /> Pick a different idea
          </button>
          {writing ? (
            <Card className="flex flex-col gap-2.5">
              <p className="text-[15px] text-ink" style={{ fontWeight: 560 }}>{draft.title}</p>
              {[92, 80, 86, 54].map((w, i) => <span key={i} className="h-3 animate-pulse rounded-pill bg-ink/8" style={{ width: `${w}%` }} />)}
            </Card>
          ) : (
            <div className={cn('transition-opacity', rewriting != null && !rewritten && 'opacity-50')}>
              <PostPreview d={draft} name={p?.linkedin_name || p?.display_name || 'You'} headline={p?.headline} photo={p?.photo_url} className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5" />
            </div>
          )}
          {!writing ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="How does it sound?">
                {REACTIONS.map((r) => <Pill key={r.key} on={reaction === r.key} onClick={() => react(r)}>{r.key}</Pill>)}
              </div>
              <AnimatePresence>
                {reaction === 'Not me at all' ? (
                  <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={(e) => { e.preventDefault(); rewrite() }} className="flex gap-2">
                    <label htmlFor="whats-off" className="sr-only">What’s off?</label>
                    <input id="whats-off" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What’s off? “Too long”, “I never say that”…" className="h-11 min-w-0 flex-1 rounded-pill border-[1.5px] border-ink/15 bg-surface px-4 text-[15px] text-ink placeholder:text-slate focus:border-ink focus:outline-none" />
                    <button type="submit" disabled={!note.trim()} className="h-11 shrink-0 rounded-pill bg-ink px-4 text-[14.5px] text-white disabled:opacity-40">Rewrite</button>
                  </motion.form>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </>
      )}
      <Actions>
        {draft && !writing ? (
          <>
            <Primary disabled={!reaction || (rewriting != null && !rewritten)} onClick={() => onNext({ first_post_choice: `${draft.id} schedule` })}>Schedule it</Primary>
            <Quiet onClick={() => onNext({ first_post_choice: draft.id })}>Keep it as a draft</Quiet>
          </>
        ) : (
          <Quiet solo onClick={() => onNext()}>{draft ? 'Carry on while I write it' : 'Skip for now'}</Quiet>
        )}
      </Actions>
    </>
  )
}

/* ---------- 10. Your first week ---------- */

const MOMENTS = [
  { key: 'coffee', emoji: '☕', label: 'With my first coffee', time: '08:30' },
  { key: 'lunch', emoji: '🥪', label: 'Before lunch', time: '12:00' },
  { key: 'evening', emoji: '🌙', label: 'At the end of the day', time: '17:30' },
] as const
const WEEKDAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri']] as const
const daysFor = (n: number) => (n === 1 ? ['tue'] : n === 2 ? ['tue', 'thu'] : n === 3 ? ['mon', 'wed', 'fri'] : ['mon', 'tue', 'wed', 'thu', 'fri'])
const momentOf = (p: Profile | null) => MOMENTS.find((m) => m.label === p?.meeting_time || m.time === p?.posting_time)?.key || 'lunch'
const hourBefore = (t: string) => { const [h, m] = t.split(':').map(Number); return `${String(Math.max(6, h - 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}` }

/** When their 10 minutes are, and how many posts a week. Also the quick question that brings it back. */
function RhythmChoices({ moment, setMoment, perWeek, setPerWeek }: { moment: string; setMoment: (k: string) => void; perWeek: number; setPerWeek: (n: number) => void }) {
  const mascot = useMascot()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-[14.5px] text-ink" style={{ fontWeight: 560 }}>When are your 10 minutes?</p>
        <div className="flex flex-wrap gap-2">
          {MOMENTS.map((m) => <Pill key={m.key} on={moment === m.key} onClick={() => { setMoment(m.key); mascot.react('happy', undefined, 800) }}><span className="mr-1.5" aria-hidden>{m.emoji}</span>{m.label}</Pill>)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[14.5px] text-ink" style={{ fontWeight: 560 }}>Posts a week</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 5].map((n) => <Pill key={n} on={perWeek === n} onClick={() => setPerWeek(n)}>{n}</Pill>)}
        </div>
      </div>
    </div>
  )
}

export function Week({ onFinish }: { onFinish: (patch?: Patch) => Promise<void> }) {
  const pod = usePod()
  const p = pod.profile
  const [moment, setMoment] = useState<string>(momentOf(p))
  const [perWeek, setPerWeek] = useState<number>(p?.posts_per_week || 2)
  const [busy, setBusy] = useState(false)
  const signedIn = p?.browser_status === 'signed_in'
  const [choiceId, how] = (p?.first_post_choice || '').split(' ')
  const first = pod.drafts.find((d) => d.id === choiceId && d.body)
  const days = daysFor(perWeek)
  const m = MOMENTS.find((x) => x.key === moment)!

  // The first post goes on the first posting day from now; the rest are drafts to approve.
  const firstDay = (() => {
    if (!first || how !== 'schedule') return null
    const at = nextSlot({ days, time: m.time, tz: p?.timezone })
    return new Date(at).toLocaleDateString('en-US', { weekday: 'short', timeZone: p?.timezone || undefined }).toLowerCase().slice(0, 3)
  })()
  const plan = WEEKDAYS.map(([d, label]) => {
    const blocks: [string, string][] = []
    if (days.includes(d)) blocks.push(['bg-lavender', d === firstDay ? 'Your first post goes out' : 'A post to approve'])
    if (signedIn) blocks.push(['bg-butter', 'Comments and replies'])
    if (d === 'fri') blocks.push(['bg-mint', 'First results'])
    return { d, label, blocks }
  })

  const finish = async () => {
    if (!p) return
    setBusy(true)
    const patch = { meeting_time: m.label, posting_time: m.time, posts_per_week: perWeek, posting_days: days, brief_channel: p.brief_channel || 'app' }
    // Switch on what the week shows: the usual plan, and with LinkedIn signed in, replies and one comment batch before their 10 minutes.
    const plan = defaultPlan({ ...p, ...patch } as Profile)
    for (const s of SKILLS) {
      const row = pod.skills.find((r) => r.key === s.key)
      if (!row) continue
      if (s.key === 'engage') {
        if (!signedIn) continue
        const settings = (row.settings || {}) as { runs?: EngageRun[]; replies?: Record<string, unknown> }
        const runs = DEFAULT_RUNS.map((d) => ({ ...d, ...((settings.runs || []).find((r) => r.key === d.key) || {}) }))
        const anyOn = runs.some((r) => r.on)
        await pod.update('skills', row.id, {
          state: 'on',
          started_at: row.started_at || new Date().toISOString(),
          settings: { ...settings, replies: { every_hours: 2, ...(settings.replies || {}), on: true }, runs: anyOn ? runs : runs.map((r) => (r.key === 'r1' ? { ...r, on: true, time: hourBefore(m.time), size: 5 } : r)) },
        })
      } else if (plan[s.key].on && row.state !== 'on') {
        await pod.update('skills', row.id, { state: 'on', started_at: row.started_at || new Date().toISOString() })
      } else if (!plan[s.key].on && plan[s.key].because && !plan[s.key].locked && row.state === 'off') {
        await pod.update('skills', row.id, { state: 'recommended' })
      }
    }
    if (first && how === 'schedule' && (first.status === 'ready' || first.status === 'drafting' || first.status === 'idea')) {
      const taken = pod.drafts.filter((d) => d.status === 'approved' && d.scheduled_for).map((d) => d.scheduled_for as string)
      await pod.update('drafts', first.id, { status: 'approved', approved_at: new Date().toISOString(), scheduled_for: nextSlot({ days, time: m.time, tz: p.timezone, taken }), first_draft: first.first_draft || first.body })
    }
    await onFinish(patch)
  }

  return (
    <>
      <Spool>That’s day one done. Nothing on this list happens without you.</Spool>
      <Title>Your first week</Title>
      {/* phones: one row per day; wider: five columns */}
      <ul className="flex flex-col gap-1.5 sm:grid sm:grid-cols-5 sm:gap-2">
        {plan.map((day) => (
          <li key={day.d} className="flex items-start gap-3 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-line sm:min-h-[118px] sm:flex-col sm:gap-1.5 sm:px-2 sm:py-2.5">
            <span className="w-9 shrink-0 pt-1 text-[12.5px] text-ink-2 sm:w-full sm:pt-0 sm:text-center" style={{ fontWeight: 600 }}>{day.label}</span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-1.5 sm:w-full sm:flex-col">
              {day.blocks.length ? day.blocks.map(([bg, t]) => <span key={t} className={cn('rounded-[9px] px-2 py-1 text-[12px] leading-tight text-ink', bg)}>{t}</span>) : <span className="py-1 text-[12px] text-slate">A quiet day</span>}
            </span>
          </li>
        ))}
      </ul>
      <Card>
        <RhythmChoices moment={moment} setMoment={setMoment} perWeek={perWeek} setPerWeek={setPerWeek} />
        <p className="mt-3 text-[12.5px] text-slate">{signedIn ? 'Each weekday: what’s waiting for you, in about 10 minutes. Change any of it in Skills and Engage.' : 'Each weekday: what’s waiting for you, in about 10 minutes. Sign in to LinkedIn and I’ll add comments and replies.'}</p>
      </Card>
      <Actions>
        <Primary busy={busy} onClick={() => void finish()}>Go to Home</Primary>
      </Actions>
    </>
  )
}

/** The rhythm on its own, as a quick question in the app (it was skipped in an earlier onboarding). */
export function Rhythm({ onNext }: { onNext: (patch: Patch) => void }) {
  const { profile: p } = usePod()
  const [moment, setMoment] = useState<string>(momentOf(p))
  const [perWeek, setPerWeek] = useState<number>(p?.posts_per_week || 2)
  const m = MOMENTS.find((x) => x.key === moment)!
  return (
    <>
      <Title sub="I picked these when you skipped. Change anything, or keep them.">When’s a good moment for your 10 minutes?</Title>
      <RhythmChoices moment={moment} setMoment={setMoment} perWeek={perWeek} setPerWeek={setPerWeek} />
      <Actions>
        <Primary onClick={() => onNext({ meeting_time: m.label, posting_time: m.time, posts_per_week: perWeek, posting_days: daysFor(perWeek) })}>These work</Primary>
        <Later />
      </Actions>
    </>
  )
}

/* ---------- older questions, still asked when an earlier onboarding skipped them ---------- */

const TONES = [
  { key: 'polite', emoji: '😊', label: 'Polite', line: 'Kind, and starts with what works' },
  { key: 'candid', emoji: '🧐', label: 'Candid', line: 'Plain and direct, no cushioning' },
  { key: 'roast', emoji: '🔥', label: 'Roast me', line: 'Playful and witty, still useful' },
] as const

export function Tone({ onNext }: { onNext: (patch: Patch) => void }) {
  const { profile } = usePod()
  const { compact } = useFlow()
  const [tone, setTone] = useState<string | null>(profile?.tone || null)
  return (
    <>
      <Title sub="About your profile, your drafts and your ideas.">How honest should I be with you?</Title>
      <div className={cn('grid gap-2.5', compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-3')}>
        {TONES.map((t) => <Tile key={t.key} on={tone === t.key} onClick={() => setTone(t.key)} emoji={t.emoji} title={t.label} sub={t.line} />)}
      </div>
      <Actions>
        <Primary disabled={!tone} onClick={() => onNext({ tone })}>Save</Primary>
        <Later />
      </Actions>
    </>
  )
}

export function Voice({ onNext }: { onNext: (patch: Patch) => void }) {
  const pod = usePod()
  const chat = useChat()
  const [mode, setMode] = useState<'mine' | 'found' | null>(pod.profile?.voice_mode || null)
  const save = () => {
    if (!mode) return
    if (mode === 'found' && pod.profile?.voice_mode !== 'found') void chat.task('[onboarding] voices')
    onNext(mode === 'mine' ? { voice_mode: 'mine', voice_import: pod.profile?.voice_import === 'done' ? 'done' : 'todo' } : { voice_mode: 'found' })
  }
  return (
    <>
      <Title>How should I sound?</Title>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Tile on={mode === 'mine'} onClick={() => setMode('mine')} emoji="✍️" title="Write like me" sub="A clean, plain style today, and yours once you import your posts." />
        <Tile on={mode === 'found'} onClick={() => setMode('found')} emoji="🔎" title="Find me a good voice" sub="Three voices that do well in your field, each with a sample. Nobody copied or named." />
      </div>
      <Actions>
        <Primary disabled={!mode} onClick={save}>Save</Primary>
        <Later />
      </Actions>
    </>
  )
}
