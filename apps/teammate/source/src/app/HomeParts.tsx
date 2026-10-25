import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, BarChart3, CalendarClock, Check, ChevronDown, ListChecks, PenLine, X } from 'lucide-react'
import { usePod } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { fmtSlot, nextSlot } from '@/lib/time'
import { latestResult, useLastVisit, useReceipt, useRhythm, vsUsual } from '@/lib/session'
import type { Review } from '@/lib/types'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { AppView } from './AppShell'
import type { ComposeStart } from './Composer'

type Go = (v: AppView, anchor?: string) => void

// ── while you were away ───────────────────────────────────────────────────────

export function Receipt() {
  const since = useLastVisit()
  const r = useReceipt(since)
  const [open, setOpen] = useState(false)
  if (!r.lines.length && !r.forYou.length) return null
  return (
    <section className="rounded-2xl bg-surface ring-1 ring-line">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4 text-left">
        <span className="text-[15px] text-ink" style={{ fontWeight: 520 }}>While you were away</span>
        <span className="min-w-0 flex-1 text-[14px] text-ink-2">{r.lines.slice(0, 4).map((l) => `${l.n} ${l.short}`).join(' · ')}</span>
        <span className="flex items-center gap-1 text-[13px] text-primary">{open ? 'Less' : 'Details'} <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} /></span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-5 border-t border-line px-5 py-4 sm:grid-cols-2">
              <ul className="flex flex-col gap-2 text-[14px] text-ink-2">
                {r.lines.map((l) => <li key={l.text} className="flex gap-3"><span className="w-7 shrink-0 text-right tabular text-ink" style={{ fontWeight: 520 }}>{l.n}</span>{l.text}</li>)}
              </ul>
              <div className="flex flex-col gap-3">
                {r.forYou.length ? (
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">Left for you</p>
                    <ul className="mt-1.5 flex flex-col gap-1.5 text-[13.5px] text-ink">{r.forYou.map((a) => <li key={a.id}>{a.detail}</li>)}</ul>
                  </div>
                ) : null}
                {r.steps.length ? (
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">Step by step</p>
                    <ul className="mt-1.5 flex flex-col gap-1.5 text-[13px] text-ink-2">{r.steps.slice(0, 5).map((a) => <li key={a.id} className="line-clamp-2">{a.detail}</li>)}</ul>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

// ── the tiles ─────────────────────────────────────────────────────────────────

function Tile({ icon, label, onClick, children, tone }: { icon: ReactNode; label: string; onClick: () => void; children: ReactNode; tone?: 'accent' }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} className={cn('group flex min-h-[132px] flex-col rounded-2xl p-4 text-left ring-1 transition-shadow hover:shadow-[0_10px_30px_-12px_rgba(23,23,33,0.25)]', tone === 'accent' ? 'bg-lavender ring-transparent' : 'bg-surface ring-line')}>
      <span className="flex w-full items-center justify-between gap-2 text-[13px] text-ink-2">
        <span className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>{label}</span>
        <ArrowUpRight className="size-4 text-slate opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="mt-3 flex flex-1 flex-col">{children}</span>
    </motion.button>
  )
}
const Big = ({ children }: { children: ReactNode }) => <span className="block truncate text-[22px] leading-tight text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{children}</span>
const Sub = ({ children }: { children: ReactNode }) => <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-ink-2">{children}</span>

export function ResultsTile({ go }: { go: Go }) {
  const pod = usePod()
  const out = pod.drafts.filter((d) => d.status === 'published').sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime())
  const withNumbers = out.find((d) => latestResult(d))
  const r = withNumbers ? latestResult(withNumbers) : null
  const x = withNumbers ? vsUsual(withNumbers, pod.drafts) : null
  return (
    <Tile icon={<BarChart3 className="size-4" />} label="Results" onClick={() => go('posts', 'published')}>
      {r ? (
        <>
          <Big>{r.people?.length ? `${r.people.length} worth knowing` : `${r.reactions ?? 0} reactions`}</Big>
          <Sub>{[r.people?.length ? `${r.reactions ?? 0} reactions` : null, r.comments != null ? `${r.comments} comments` : null, x != null ? `${x}× your usual` : null].filter(Boolean).join(' · ')}</Sub>
        </>
      ) : out.length ? (
        <><Big>Coming in</Big><Sub>I read your last post’s numbers a day after it’s out.</Sub></>
      ) : (
        <><Big>None yet</Big><Sub>Your first post’s numbers show here a day after it’s out.</Sub></>
      )}
    </Tile>
  )
}

export function RhythmTile({ go }: { go: Go }) {
  const r = useRhythm()
  const pct = Math.min(100, Math.round((r.done / Math.max(1, r.goal)) * 100))
  const behind = r.done + r.booked < r.goal
  return (
    <Tile icon={<CalendarClock className="size-4" />} label="This week" onClick={() => go('posts')}>
      <span className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="relative grid size-14 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-lavender) 0)` }} aria-label={`${r.done} of ${r.goal} posts this week`}>
          <span className="grid size-11 place-items-center rounded-full bg-surface text-[13px] tabular text-ink" style={{ fontWeight: 520 }}>{r.done}/{r.goal}</span>
        </span>
        <span className="min-w-0 text-[13px] leading-snug text-ink-2">
          {r.done >= r.goal ? 'Done for the week.' : r.left.length ? `${r.left.join(', ')} to go` : 'This week’s slots have passed'}
          {r.done < r.goal ? <span className="block">{r.booked ? `${r.booked} scheduled` : behind && r.ready ? `${r.ready} ready to approve` : ''}</span> : null}
        </span>
      </span>
      <Sub>{r.run > 1 ? `${r.run} weeks on rhythm.` : r.first ? 'Your first week. Weeks count, not days.' : 'Weeks on rhythm count, not days.'}</Sub>
    </Tile>
  )
}

export function NextPostTile({ go }: { go: Go }) {
  const pod = usePod()
  const tz = pod.profile?.timezone
  const next = pod.drafts.filter((d) => d.status === 'approved' && d.scheduled_for && new Date(d.scheduled_for).getTime() > Date.now()).sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())[0]
  return (
    <Tile icon={<CalendarClock className="size-4" />} label="Next post" onClick={() => go('posts')}>
      <Big>{next ? fmtSlot(next.scheduled_for, tz) : 'None yet'}</Big>
      <Sub>{next ? next.title || next.body?.slice(0, 60) : 'Approve one in your 10 minutes.'}</Sub>
    </Tile>
  )
}

export function WriteTile({ compose }: { compose: (s: ComposeStart) => void }) {
  return (
    <Tile icon={<PenLine className="size-4" />} label="Write a post" onClick={() => compose({})}>
      <Big>New</Big>
      <Sub>Pick a format and an idea, or let Spool interview you.</Sub>
    </Tile>
  )
}

// ── setup, until it's done ────────────────────────────────────────────────────

export function useSetup(go: Go, startSession: () => void) {
  const pod = usePod()
  const p = pod.profile
  const r = useRhythm()
  const items = [
    { key: 'you', label: 'Spool knows you and your goals', done: !!(p?.profile_confirmed || p?.goals?.length || p?.goal_note), go: () => go('personal', 'about') },
    { key: 'rhythm', label: 'Your rhythm', done: !!p?.posting_days?.length, go: () => go('personal', 'schedule') },
    { key: 'voice', label: 'A voice to write in', done: !!p?.voice_mode, go: () => go('personal', 'voice') },
    { key: 'first', label: 'Your first post live', done: r.published > 0, go: startSession, hint: pod.drafts.some((d) => d.status === 'ready') ? 'one is ready' : undefined },
    { key: 'browser', label: 'Your browser, so Spool can find replies and people', done: p?.browser_status === 'signed_in', go: () => go('personal', 'connections') },
    { key: 'brand', label: 'Your brand kit, for carousels', done: !!(p?.brand?.colors?.primary || p?.brand?.logo || p?.brand?.wordmark), go: () => go('personal', 'brand') },
  ]
  const done = items.filter((i) => i.done).length
  return { items, done, total: items.length, complete: done === items.length }
}

export function SetupTile({ go, startSession }: { go: Go; startSession: () => void }) {
  const s = useSetup(go, startSession)
  const [open, setOpen] = useState(false)
  const next = s.items.find((i) => !i.done)
  return (
    <>
      <Tile icon={<ListChecks className="size-4" />} label="Getting set up" onClick={() => setOpen(true)} tone="accent">
        <Big>{s.done} of {s.total}</Big>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-primary" style={{ width: `${(s.done / s.total) * 100}%` }} /></span>
        <Sub>Next: {next?.label.toLowerCase()}</Sub>
      </Tile>
      <AnimatePresence>
        {open ? (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171721]/50 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div role="dialog" aria-modal="true" aria-label="Getting set up" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[22px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Getting set up</h2>
                  <p className="mt-1 text-[14px] text-ink-2">{s.done} of {s.total} done. This list goes away when it’s finished.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label="Close"><X className="size-4" /></button>
              </div>
              <ul className="mt-5 flex flex-col gap-1">
                {s.items.map((i) => (
                  <li key={i.key}>
                    <button type="button" disabled={i.done} onClick={() => { setOpen(false); i.go() }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-lavender/60 disabled:hover:bg-transparent">
                      <span className={cn('grid size-6 shrink-0 place-items-center rounded-full ring-2', i.done ? 'bg-primary text-white ring-primary' : 'ring-line')}>{i.done ? <Check className="size-3.5" /> : null}</span>
                      <span className={cn('min-w-0 flex-1 text-[15px]', i.done ? 'text-ink-2' : 'text-ink')}>{i.label}{!i.done && i.hint ? <span className="text-ink-2"> · {i.hint}</span> : null}</span>
                      {!i.done ? <ArrowUpRight className="size-4 text-primary" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

// ── Monday: your week ─────────────────────────────────────────────────────────

export function WeekReview() {
  const pod = usePod()
  const chat = useChat()
  const tz = pod.profile?.timezone
  const r = pod.reviews.find((x) => x.status === 'new' && Date.now() - new Date(x.created_at || 0).getTime() < 6 * 86400e3)
  const [busy, setBusy] = useState(false)
  if (!r) return null
  const plan = (r.plan || []).filter((x) => x.title || x.draft_id)
  const approvePlan = async (rv: Review) => {
    setBusy(true)
    const p = pod.profile
    const taken = pod.drafts.filter((x) => x.status === 'approved' && x.scheduled_for).map((x) => x.scheduled_for as string)
    for (const item of rv.plan || []) {
      const d = pod.drafts.find((x) => x.id === item.draft_id)
      if (!d || d.status !== 'ready') continue
      const slot = item.slot && new Date(item.slot).getTime() > Date.now() + 600000 && !taken.includes(item.slot) ? item.slot : nextSlot({ days: p?.posting_days, time: p?.posting_time, tz: p?.timezone, taken })
      taken.push(slot)
      await pod.update('drafts', d.id, { status: 'approved', approved_at: new Date().toISOString(), scheduled_for: slot })
    }
    await pod.update('reviews', rv.id, { status: 'approved' })
    setBusy(false)
  }
  const n = r.numbers || {}
  const stats = [n.posts != null ? `${n.posts} post${n.posts === 1 ? '' : 's'} out` : null, n.reactions ? `${n.reactions} reactions` : null, n.accepted ? `${n.accepted} accepted` : null, n.conversations ? `${n.conversations} conversation${n.conversations === 1 ? '' : 's'}` : null].filter(Boolean)
  return (
    <section className="rounded-3xl bg-surface p-6 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">Your week</p>
          <h2 className="mt-1 text-[22px] leading-tight text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{r.summary?.split('\n')[0] || 'Last week, and this week’s plan'}</h2>
          {stats.length ? <p className="mt-1 text-[14px] text-ink-2">{stats.join(' · ')}</p> : null}
        </div>
        <button type="button" onClick={() => void pod.update('reviews', r.id, { status: 'dismissed' })} className="grid size-9 shrink-0 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label="Dismiss"><X className="size-4" /></button>
      </div>
      {r.best?.title || r.best?.line ? (
        <p className="mt-4 rounded-xl bg-lavender px-3 py-2 text-[14px] text-ink-2"><span className="text-ink" style={{ fontWeight: 480 }}>Best: </span>{r.best.line || r.best.title}{r.best.why ? <> <span className="text-ink" style={{ fontWeight: 480 }}>Why: </span>{r.best.why}</> : null}</p>
      ) : null}
      {plan.length ? (
        <div className="mt-4">
          <p className="text-[13px] text-ink-2">This week</p>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {plan.map((x, i) => (
              <li key={i} className="flex items-center gap-3 py-2 text-[14px]">
                <span className="w-24 shrink-0 tabular text-ink-2">{x.slot ? fmtSlot(x.slot, tz) : 'next slot'}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{x.title || pod.drafts.find((d) => d.id === x.draft_id)?.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {r.suggestion ? <p className="mt-3 text-[13.5px] text-ink-2"><span className="text-ink" style={{ fontWeight: 480 }}>One suggestion: </span>{r.suggestion}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {plan.length ? <Button variant="primary" busy={busy} onClick={() => void approvePlan(r)}>Looks good</Button> : null}
        <Button onClick={() => void chat.send('Let’s change this week’s plan.', { fresh: true, context: `Weekly review · ${r.week_of || ''}` })}>Change it</Button>
      </div>
    </section>
  )
}
