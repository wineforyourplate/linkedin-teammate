import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ExternalLink, X } from 'lucide-react'
import { usePod } from '@/lib/data'
import { fmtSlot, nextSlot } from '@/lib/time'
import { CAPS, fromIST, useRhythm, useSessionQueues, type Queue } from '@/lib/session'
import type { Person } from '@/lib/types'
import { Button } from '@/components/ui'
import { CastMascot } from '@/components/cast/CastMascot'
import { TeachChips } from '@/components/Teach'
import { KeepGoing, plural } from '@/components/KeepGoing'
import { PostPreview, useApprove } from '@/views/Today'
import { ReplyCard } from '@/views/Engage'
import { QuickQuestion, useQuickQueue } from '@/views/QuickQuestion'
import { cn } from '@/lib/utils'
import type { ComposeStart } from './Composer'

/* Your 10 minutes: everything Spool needs from you today, as one short run with an end.
   Posts to approve, replies to post, people to decide on, one question; each queue
   capped so it always fits. When a queue has more than today's share, you choose:
   keep going, or leave the rest for tomorrow. It ends at "You're all caught up". */


export function useTenMinutes() {
  const quick = useQuickQueue()
  const q = useSessionQueues(quick.queue[0] || null)
  return { ...q, quick }
}

// ── the card on Home ──────────────────────────────────────────────────────────

export function TenMinutesCard({ onStart, compose }: { onStart: () => void; compose: (s: ComposeStart) => void }) {
  const t = useTenMinutes()
  const rhythm = useRhythm()
  const firstPost = rhythm.published === 0 && t.posts.items.length > 0
  const chips = ([
    ['posts', t.posts.items.length],
    ['replies', t.replies.items.length],
    ['people', t.people.items.length],
    ['question', t.questions.items.length],
  ] as [Queue, number][]).filter(([, n]) => n > 0)

  if (!t.count) return <CaughtUp compose={compose} />
  return (
    <section className="relative isolate flex flex-col gap-5 overflow-hidden rounded-3xl bg-night p-6 text-on-dark sm:flex-row sm:items-center sm:p-7">
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(rgb(237_237_243/.09)_1px,transparent_1.4px)] [background-size:20px_20px]" />
      <CastMascot size={92} mood={firstPost ? 'love' : 'happy'} sleepAfter={0} quiet className="-my-3 -ml-2 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[26px] leading-tight sm:text-[28px]" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{firstPost ? 'Your first post is ready' : 'Your 10 minutes'}</h2>
        <p className="mt-1 text-[14.5px] text-fog">{firstPost ? 'Make it yours, then it goes out on your next slot.' : `${t.count} thing${t.count === 1 ? '' : 's'} · about ${t.minutes} minute${t.minutes === 1 ? '' : 's'}`}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map(([k, n]) => <span key={k} className="rounded-pill bg-[#9cb4e8]/15 px-2.5 py-1 text-[12.5px] text-on-dark">{k === 'question' ? 'one question' : plural(k, n)}</span>)}
        </div>
      </div>
      <Button variant="primary" size="lg" onClick={onStart} className="shrink-0 self-start sm:self-center">{t.doneToday ? 'Carry on' : 'Start'}</Button>
    </section>
  )
}

/** Nothing waiting: say what happens next instead of a blank. */
function CaughtUp({ compose }: { compose: (s: ComposeStart) => void }) {
  const pod = usePod()
  const t = useTenMinutes()
  const tz = pod.profile?.timezone
  const next = pod.drafts.filter((d) => d.status === 'approved' && d.scheduled_for && new Date(d.scheduled_for).getTime() > Date.now()).sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())[0]
  const rested = ([['people', t.people], ['replies', t.replies], ['posts', t.posts]] as const).filter(([, q]) => q.rested && q.waiting).map(([k, q]) => plural(k, q.waiting))
  const browserJobs = pod.skills.some((s) => (s.key === 'engage' || s.key === 'find_people') && s.state === 'on')
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-6 ring-1 ring-line sm:flex-row sm:items-center sm:p-7">
      <CastMascot size={84} mood="happy" sleepAfter={0} quiet className="-my-2 -ml-2 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[24px] leading-tight text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{t.doneToday ? 'You’re all caught up' : 'Nothing needs you right now'}</h2>
        <ul className="mt-2 flex flex-col gap-1 text-[14px] text-ink-2">
          {next ? <li>Your next post goes out {fmtSlot(next.scheduled_for, tz)}.</li> : null}
          <li>New drafts by {fromIST('07:30', tz)}{browserJobs ? `; replies and people at ${fromIST('10:40', tz)} and ${fromIST('16:10', tz)}` : ''}.</li>
          {rested.length ? <li>Waiting for tomorrow: {rested.join(', ')}.</li> : null}
        </ul>
      </div>
      <Button onClick={() => compose({})} className="shrink-0 self-start sm:self-center">Write a post</Button>
    </section>
  )
}

// ── the run itself ────────────────────────────────────────────────────────────

type Step =
  | { kind: 'post'; id: string }
  | { kind: 'reply'; id: string }
  | { kind: 'people'; ids: string[] }
  | { kind: 'question' }
  | { kind: 'more'; queue: Queue; shown: number }
  | { kind: 'done' }

export function TenMinutes({ onClose, compose }: { onClose: () => void; compose: (s: ComposeStart) => void }) {
  const pod = usePod()
  const t = useTenMinutes()
  const tz = pod.profile?.timezone
  const [at, setAt] = useState(0)
  const handled = useRef(0)

  // The run is fixed when it opens; "Keep going" adds the next batch in place.
  const initial = useMemo(() => {
    const s: Step[] = []
    for (const d of t.posts.items) s.push({ kind: 'post', id: d.id })
    if (t.posts.more) s.push({ kind: 'more', queue: 'posts', shown: t.posts.items.length })
    for (const e of t.replies.items) s.push({ kind: 'reply', id: e.id })
    if (t.replies.more) s.push({ kind: 'more', queue: 'replies', shown: t.replies.items.length })
    if (t.people.items.length) s.push({ kind: 'people', ids: t.people.items.map((p) => p.id) })
    if (t.people.more) s.push({ kind: 'more', queue: 'people', shown: t.people.items.length })
    if (t.questions.items.length) s.push({ kind: 'question' })
    s.push({ kind: 'done' })
    return s
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [steps, setSteps] = useState<Step[]>(initial)
  const step = steps[Math.min(at, steps.length - 1)]
  const work = steps.filter((s) => s.kind !== 'more' && s.kind !== 'done').length
  const doneWork = steps.slice(0, at).filter((s) => s.kind !== 'more' && s.kind !== 'done').length
  const next = () => { handled.current++; setAt((i) => Math.min(i + 1, steps.length - 1)) }

  const keepGoing = (queue: Queue) => {
    t.choices.keepGoing(queue)
    const seen = new Set(steps.flatMap((s) => (s.kind === 'post' || s.kind === 'reply' ? [s.id] : s.kind === 'people' ? s.ids : [])))
    const add: Step[] = []
    if (queue === 'people') {
      const batch = pod.people.filter((p) => p.stage === 'found' && !seen.has(p.id)).sort((a, b) => (b.score || 0) - (a.score || 0))
      if (batch.length) add.push({ kind: 'people', ids: batch.slice(0, CAPS.people).map((p) => p.id) })
      if (batch.length > CAPS.people) add.push({ kind: 'more', queue, shown: CAPS.people })
    } else if (queue === 'replies') {
      const batch = pod.engagements.filter((e) => (e.status === 'proposed' || e.status === 'liked' || e.status === 'failed') && e.comment_draft && !seen.has(e.id))
      for (const e of batch.slice(0, CAPS.replies)) add.push({ kind: 'reply', id: e.id })
      if (batch.length > CAPS.replies) add.push({ kind: 'more', queue, shown: CAPS.replies })
    } else if (queue === 'posts') {
      const batch = pod.drafts.filter((d) => d.status === 'ready' && !seen.has(d.id))
      for (const d of batch.slice(0, CAPS.posts)) add.push({ kind: 'post', id: d.id })
      if (batch.length > CAPS.posts) add.push({ kind: 'more', queue, shown: CAPS.posts })
    }
    setSteps((s) => [...s.slice(0, at + 1), ...add, ...s.slice(at + 1)])
    setAt((i) => i + 1)
  }
  const leave = (queue: Queue) => { t.choices.leave(queue); next() }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const left = work - doneWork
  return (
    <motion.div className="fixed inset-0 z-40 flex flex-col bg-canvas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25 }} role="dialog" aria-modal="true" aria-label="Your 10 minutes">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-primary/8" aria-label="Close"><X className="size-5" /></button>
          <p className="min-w-0 flex-1 text-[15px] text-ink" style={{ fontWeight: 480 }}>Your 10 minutes</p>
          <p className="text-[13px] tabular text-slate">{step.kind === 'done' ? 'Done' : left > 0 ? `${left} left` : ''}</p>
        </div>
        <div className="mx-auto mt-3 flex max-w-2xl gap-1" aria-hidden>
          {Array.from({ length: Math.max(1, work) }).map((_, i) => <i key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < doneWork || step.kind === 'done' ? 'bg-primary' : 'bg-lavender')} />)}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div key={at} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
              {step.kind === 'post' ? <PostStep id={step.id} first={steps.findIndex((s) => s.kind === 'post') === at} next={next} compose={compose} /> : null}
              {step.kind === 'reply' ? <ReplyStep id={step.id} n={steps.slice(0, at + 1).filter((s) => s.kind === 'reply').length} of={steps.filter((s) => s.kind === 'reply').length} next={next} /> : null}
              {step.kind === 'people' ? <PeopleStep ids={step.ids} next={next} /> : null}
              {step.kind === 'question' ? <QuestionStep next={() => { t.choices.answeredOne(); next() }} /> : null}
              {step.kind === 'more' ? <KeepGoing queue={step.queue} shown={step.shown} more={moreOf(step.queue, pod, steps)} onKeepGoing={() => keepGoing(step.queue)} onLeave={() => leave(step.queue)} /> : null}
              {step.kind === 'done' ? <DoneStep onClose={onClose} tz={tz} /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

function moreOf(queue: Queue, pod: ReturnType<typeof usePod>, steps: Step[]): number {
  const seen = new Set(steps.flatMap((s) => (s.kind === 'post' || s.kind === 'reply' ? [s.id] : s.kind === 'people' ? s.ids : [])))
  if (queue === 'people') return pod.people.filter((p) => p.stage === 'found' && !seen.has(p.id)).length
  if (queue === 'replies') return pod.engagements.filter((e) => (e.status === 'proposed' || e.status === 'liked') && e.comment_draft && !seen.has(e.id)).length
  if (queue === 'posts') return pod.drafts.filter((d) => d.status === 'ready' && !seen.has(d.id)).length
  return 0
}

function StepHead({ eyebrow, title }: { eyebrow: string; title: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">{eyebrow}</p>
      <h2 className="mt-1 text-[24px] leading-tight text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{title}</h2>
    </div>
  )
}

function PostStep({ id, first, next, compose }: { id: string; first: boolean; next: () => void; compose: (s: ComposeStart) => void }) {
  const pod = usePod()
  const approve = useApprove()
  const rhythm = useRhythm()
  const p = pod.profile
  const d = pod.drafts.find((x) => x.id === id)
  const [busy, setBusy] = useState(false)
  if (!d) return <Gone next={next} />
  const taken = pod.drafts.filter((x) => x.status === 'approved' && x.scheduled_for).map((x) => x.scheduled_for as string)
  const slot = d.scheduled_for && new Date(d.scheduled_for).getTime() > Date.now() + 600000 ? d.scheduled_for : nextSlot({ days: p?.posting_days, time: p?.posting_time, tz: p?.timezone, taken })
  const decided = d.status !== 'ready'
  return (
    <div>
      <StepHead eyebrow="A post to approve" title={first && rhythm.published === 0 ? 'Your first post. Make it yours.' : d.title || 'Ready to go'} />
      <PostPreview d={d} name={p?.linkedin_name || p?.display_name || 'You'} headline={p?.headline} photo={p?.photo_url} className="rounded-2xl bg-surface p-5 ring-1 ring-line" />
      {d.why_now ? <p className="mt-3 rounded-xl bg-lavender px-3 py-2 text-[13.5px] text-ink-2"><span className="text-ink" style={{ fontWeight: 480 }}>Why this one: </span>{d.why_now}</p> : null}
      <div className="mt-4"><TeachChips d={d} compose={compose} onDropped={next} /></div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {decided ? (
          <><span className="inline-flex items-center gap-1.5 text-[14px] text-ink-2"><Check className="size-4 text-primary" /> {d.status === 'killed' ? 'Dropped' : `Goes out ${fmtSlot(d.scheduled_for, p?.timezone)}`}</span><Button variant="primary" onClick={next}>Next</Button></>
        ) : (
          <>
            <Button variant="primary" busy={busy} onClick={async () => { setBusy(true); await approve(d); setBusy(false); next() }}>Approve for {fmtSlot(slot, p?.timezone)}</Button>
            <Button onClick={() => compose({ draft: d })}>Work on it</Button>
            <Button variant="ghost" onClick={() => { void pod.update('drafts', d.id, { status: 'killed' }); next() }}>Not this one</Button>
            <Button variant="ghost" onClick={next} className="ml-auto">Later</Button>
          </>
        )}
      </div>
    </div>
  )
}

function ReplyStep({ id, n, of, next }: { id: string; n: number; of: number; next: () => void }) {
  const pod = usePod()
  const e = pod.engagements.find((x) => x.id === id)
  if (!e) return <Gone next={next} />
  return (
    <div>
      <StepHead eyebrow={`A reply to post · ${n} of ${of}`} title={`Join ${e.author_name?.split(' ')[0] || 'this'}’s conversation`} />
      <div className="rounded-2xl bg-surface p-5 ring-1 ring-line"><ReplyCard e={e} onDone={next} flat /></div>
      <div className="mt-3 flex justify-end"><Button variant="ghost" onClick={next}>Later</Button></div>
    </div>
  )
}

function PeopleStep({ ids, next }: { ids: string[]; next: () => void }) {
  const pod = usePod()
  const rows = ids.map((id) => pod.people.find((p) => p.id === id)).filter((p): p is Person => !!p)
  const decide = (p: Person, stage: 'approved' | 'skipped') => void pod.update('people', p.id, { stage })
  const open = rows.filter((p) => p.stage === 'found').length
  return (
    <div>
      <StepHead eyebrow="People worth knowing" title={`${rows.length} ${rows.length === 1 ? 'person' : 'people'} to decide on`} />
      <p className="-mt-2 mb-4 text-[14px] text-ink-2">Approve the ones you’d like to know. I’ll write each a short note before anything is sent.</p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {rows.map((p) => (
          <li key={p.id} className={cn('flex items-start gap-3 p-4 transition-opacity', p.stage !== 'found' && 'opacity-55')}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender text-[15px] text-ink-2">{p.name.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-ink" style={{ fontWeight: 470 }}>
                {p.name}
                {p.profile_url ? <a href={p.profile_url} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex text-slate hover:text-primary" aria-label={`Open ${p.name} on LinkedIn`}><ExternalLink className="size-3.5" /></a> : null}
              </p>
              {p.headline ? <p className="truncate text-[13px] text-slate">{p.headline}</p> : null}
              {p.reason ? <p className="mt-1 line-clamp-2 text-[13.5px] text-ink-2">{p.reason}</p> : null}
            </div>
            {p.stage === 'found' ? (
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => decide(p, 'approved')} className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary/15" aria-label={`Approve ${p.name}`}><Check className="size-4" /></button>
                <button type="button" onClick={() => decide(p, 'skipped')} className="grid size-10 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label={`Skip ${p.name}`}><X className="size-4" /></button>
              </div>
            ) : <span className="shrink-0 text-[13px] text-ink-2">{p.stage === 'approved' ? 'Approved' : 'Skipped'}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end"><Button variant={open ? 'ghost' : 'primary'} onClick={next}>{open ? 'Decide later' : 'Next'}</Button></div>
    </div>
  )
}

function QuestionStep({ next }: { next: () => void }) {
  const quick = useQuickQueue()
  const first = useRef(quick.queue[0])
  // answered (or put off): it leaves the queue, so move on
  useEffect(() => { if (first.current && quick.queue[0] !== first.current) next() }, [quick.queue[0]]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!quick.queue.length) return <Gone next={next} />
  return (
    <div>
      <StepHead eyebrow="Last one" title="One quick question" />
      <QuickQuestion q={quick} />
      <div className="mt-3 flex justify-end"><Button variant="ghost" onClick={next}>Skip it today</Button></div>
    </div>
  )
}

function DoneStep({ onClose, tz }: { onClose: () => void; tz?: string | null }) {
  const pod = usePod()
  const next = pod.drafts.filter((d) => d.status === 'approved' && d.scheduled_for && new Date(d.scheduled_for).getTime() > Date.now()).sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())[0]
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <CastMascot size={130} mood="celebrate" sleepAfter={0} quiet />
      <h2 className="text-[30px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>You’re all caught up</h2>
      <p className="max-w-md text-[15px] text-ink-2">
        {next ? `Your next post goes out ${fmtSlot(next.scheduled_for, tz)}. ` : ''}I’ll have new drafts by {fromIST('07:30', tz)}, and anything new waits here for tomorrow.
      </p>
      <Button variant="primary" size="lg" onClick={onClose}>Back to Home</Button>
    </div>
  )
}

function Gone({ next }: { next: () => void }) {
  useEffect(() => { next() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
