import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePod } from './data'
import type { Draft, Engagement, Person } from './types'

/* The daily 10 minutes. Everything Spool needs from you today, as short capped queues
   (3 posts, 5 replies, 5 people, 1 question), so the session always fits and always
   ends. When a queue has more than its cap, you choose, like a photo app's review:
   keep going with the next batch, or leave the rest for tomorrow. Also here: what
   Spool did since your last visit, the week's rhythm, and the setup list. */

export type Queue = 'posts' | 'replies' | 'people' | 'question'
export const CAPS: Record<Queue, number> = { posts: 3, replies: 5, people: 5, question: 1 }
const MINUTES: Record<Queue, number> = { posts: 1.5, replies: 1, people: 0.4, question: 0.5 }

/** YYYY-MM-DD for a moment, on the person's wall clock. */
export function dayKey(at: Date | string | number = new Date(), tz?: string | null): string {
  const d = new Date(at)
  return d.toLocaleDateString('en-CA', { timeZone: tz || undefined }) // en-CA gives YYYY-MM-DD
}
const isToday = (iso: string | null | undefined, tz?: string | null) => !!iso && dayKey(iso, tz) === dayKey(new Date(), tz)

// ── keep going / leave it for tomorrow (this device, today) ─────────────────────

const KEY = 'teammate.today'
interface TodayState { day: string; extra: Partial<Record<Queue, number>>; rested: Partial<Record<Queue, boolean>>; answered: number }
function read(day: string): TodayState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as TodayState | null
    if (v && v.day === day) return { ...v, extra: v.extra || {}, rested: v.rested || {}, answered: v.answered || 0 }
  } catch {
    /* private window: today's choices just aren't remembered */
  }
  return { day, extra: {}, rested: {}, answered: 0 }
}
const listeners = new Set<() => void>()
function write(v: TodayState) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* fine */ }
  for (const l of listeners) l()
}

export function useTodayChoices(tz?: string | null) {
  const day = dayKey(new Date(), tz)
  const [state, setState] = useState<TodayState>(() => read(day))
  useEffect(() => {
    const on = () => setState(read(day))
    listeners.add(on)
    on()
    return () => { listeners.delete(on) }
  }, [day])
  const keepGoing = useCallback((q: Queue) => { const s = read(day); write({ ...s, extra: { ...s.extra, [q]: (s.extra[q] || 0) + CAPS[q] }, rested: { ...s.rested, [q]: false } }) }, [day])
  const leave = useCallback((q: Queue) => { const s = read(day); write({ ...s, rested: { ...s.rested, [q]: true } }) }, [day])
  const answered = useCallback(() => { const s = read(day); write({ ...s, answered: s.answered + 1 }) }, [day])
  return { ...state, keepGoing, leave, answeredOne: answered }
}

// ── the queues ────────────────────────────────────────────────────────────────

export const openReply = (e: Engagement) => (e.status === 'proposed' || e.status === 'liked' || e.status === 'failed') && !!e.comment_draft

export interface QueueState<T> {
  items: T[] // today's, within the budget
  waiting: number // everything that could be shown
  doneToday: number
  more: number // beyond today's budget
  rested: boolean
}

function capped<T>(all: T[], doneToday: number, cap: number, rested: boolean): QueueState<T> {
  const budget = rested ? 0 : Math.max(0, cap - doneToday)
  const items = all.slice(0, budget)
  return { items, waiting: all.length, doneToday, more: Math.max(0, all.length - items.length), rested }
}

export function useSessionQueues(question: string | null) {
  const pod = usePod()
  const tz = pod.profile?.timezone
  const choices = useTodayChoices(tz)
  const cap = (q: Queue) => CAPS[q] + (choices.extra[q] || 0)

  const postsAll = pod.drafts.filter((d) => d.status === 'ready').sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
  const postsDone = pod.drafts.filter((d) => (isToday(d.approved_at, tz) && d.status !== 'ready') || (d.status === 'killed' && isToday(d.updated_at, tz))).length
  const repliesAll = pod.engagements.filter(openReply).sort((a, b) => new Date(b.posted_at || b.created_at || 0).getTime() - new Date(a.posted_at || a.created_at || 0).getTime())
  const repliesDone = pod.engagements.filter((e) => (e.status === 'commented' || e.status === 'skipped' || e.status === 'approved' || e.status === 'posting') && isToday(e.done_at || e.updated_at, tz)).length
  const peopleAll = pod.people.filter((p) => p.stage === 'found').sort((a, b) => (b.score || 0) - (a.score || 0))
  const peopleDone = pod.people.filter((p) => (p.stage === 'approved' || p.stage === 'skipped') && isToday(p.updated_at, tz)).length

  const posts = capped<Draft>(postsAll, postsDone, cap('posts'), !!choices.rested.posts)
  const replies = capped<Engagement>(repliesAll, repliesDone, cap('replies'), !!choices.rested.replies)
  const people = capped<Person>(peopleAll, peopleDone, cap('people'), !!choices.rested.people)
  const q = question && choices.answered < CAPS.question && !choices.rested.question ? [question] : []
  const questions: QueueState<string> = { items: q, waiting: question ? 1 : 0, doneToday: choices.answered, more: 0, rested: !!choices.rested.question }

  const count = posts.items.length + replies.items.length + people.items.length + questions.items.length
  const minutes = Math.max(1, Math.round(posts.items.length * MINUTES.posts + replies.items.length * MINUTES.replies + people.items.length * MINUTES.people + questions.items.length * MINUTES.question))
  const doneToday = postsDone + repliesDone + peopleDone + choices.answered
  return { posts, replies, people, questions, count, minutes, doneToday, choices }
}

// ── while you were away ───────────────────────────────────────────────────────

export interface ReceiptLine { n: number; text: string; short: string }

/** The previous visit, held for the whole visit; the new one is recorded a few seconds in. */
export function useLastVisit() {
  const pod = usePod()
  const p = pod.profile
  const since = useRef<string | null>(null)
  if (since.current === null && p) since.current = p.last_seen_at || p.agreed_at || new Date(Date.now() - 24 * 3600e3).toISOString()
  useEffect(() => {
    if (!p) return
    const last = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0
    if (Date.now() - last < 20 * 60 * 1000) return // one visit is one visit
    const t = window.setTimeout(() => void pod.update('profile', p.id, { last_seen_at: new Date().toISOString() }), 8000)
    return () => window.clearTimeout(t)
  }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return since.current
}

export function useReceipt(since: string | null) {
  const pod = usePod()
  return useMemo(() => {
    const from = since ? new Date(since).getTime() : Date.now() - 24 * 3600e3
    const after = (iso?: string | null) => !!iso && new Date(iso).getTime() > from
    const acts = pod.activity.filter((a) => after(a.created_at))
    const n = (f: (a: (typeof acts)[number]) => boolean) => acts.filter(f).length
    const lines: ReceiptLine[] = [
      { n: n((a) => a.action === 'like'), text: 'posts liked in your field', short: 'likes' },
      { n: n((a) => a.action === 'view_profile'), text: 'profiles read', short: 'profiles read' },
      { n: pod.people.filter((p) => after(p.created_at)).length, text: 'people found worth knowing', short: 'people found' },
      { n: n((a) => a.action === 'accept_invite'), text: 'invites accepted that fit', short: 'invites accepted' },
      { n: n((a) => a.action === 'invite'), text: 'invitations sent', short: 'invitations sent' },
      { n: n((a) => a.action === 'message'), text: 'messages sent', short: 'messages' },
      { n: pod.drafts.filter((d) => after(d.created_at) && d.status !== 'idea' && d.status !== 'killed').length, text: 'posts drafted', short: 'drafts' },
      { n: pod.drafts.filter((d) => after(d.created_at) && d.status === 'idea').length, text: 'new ideas', short: 'ideas' },
      { n: pod.engagements.filter((e) => after(e.created_at) && e.comment_draft).length, text: 'replies drafted', short: 'replies drafted' },
      { n: pod.drafts.filter((d) => after(d.published_at)).length, text: 'posts went out', short: 'posted' },
    ].filter((l) => l.n > 0) as ReceiptLine[]
    // anything Spool left for them, in its own words
    const forYou = acts.filter((a) => a.result === 'warning' || /for you to|you to decide|needs you|your call/i.test(a.detail || '')).slice(0, 3)
    const steps = acts.filter((a) => a.detail && a.action !== 'page_load' && a.action !== 'check').slice(0, 8)
    return { lines, forYou, steps, since: from }
  }, [since, pod.activity, pod.people, pod.drafts, pod.engagements])
}

// ── the week ──────────────────────────────────────────────────────────────────

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

/** Monday 00:00 of the week `at` falls in, on their wall clock, as a YYYY-MM-DD key. */
export function weekOf(at: Date | string | number, tz?: string | null): string {
  const key = dayKey(at, tz)
  const [y, m, d] = key.split('-').map(Number)
  const local = new Date(Date.UTC(y, m - 1, d))
  const back = (local.getUTCDay() + 6) % 7
  local.setUTCDate(local.getUTCDate() - back)
  return local.toISOString().slice(0, 10)
}

export function useRhythm() {
  const pod = usePod()
  const p = pod.profile
  const tz = p?.timezone
  return useMemo(() => {
    const days = (p?.posting_days?.length ? p.posting_days : ['tue', 'thu']).map((d) => d.toLowerCase().slice(0, 3))
    const goal = p?.posts_per_week || days.length || 2
    const thisWeek = weekOf(new Date(), tz)
    const out = pod.drafts.filter((d) => d.status === 'published' && d.published_at)
    const doneThisWeek = out.filter((d) => weekOf(d.published_at!, tz) === thisWeek).length
    const booked = pod.drafts.filter((d) => (d.status === 'approved' || d.status === 'publishing') && d.scheduled_for && weekOf(d.scheduled_for, tz) === thisWeek).length
    const todayDow = DOW[new Date(new Date().toLocaleString('en-US', { timeZone: tz || undefined })).getDay()]
    const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const left = days.filter((d) => order.indexOf(d) >= order.indexOf(todayDow)).sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const ready = pod.drafts.filter((d) => d.status === 'ready').length
    // weeks on rhythm, counting back from last week; one quiet week a month doesn't break it
    let run = 0
    let quietUsed = ''
    const start = p?.agreed_at ? weekOf(p.agreed_at, tz) : thisWeek
    for (let i = 1; i < 60; i++) {
      const wk = new Date(thisWeek + 'T00:00:00Z')
      wk.setUTCDate(wk.getUTCDate() - 7 * i)
      const key = wk.toISOString().slice(0, 10)
      if (key < start) break
      const n = out.filter((d) => weekOf(d.published_at!, tz) === key).length
      if (n >= goal) { run++; continue }
      const month = key.slice(0, 7)
      if (quietUsed !== month) { quietUsed = month; continue }
      break
    }
    if (doneThisWeek >= goal) run++
    return { goal, done: doneThisWeek, booked, left: left.map((d) => LABEL[d]), days, today: todayDow, ready, run, first: start === thisWeek, published: out.length }
  }, [p?.posting_days, p?.posts_per_week, p?.agreed_at, tz, pod.drafts])
}

// ── results ───────────────────────────────────────────────────────────────────

/** A post's numbers against their own usual (the median of earlier posts), once there are three. */
export function vsUsual(d: Draft, all: Draft[]): number | null {
  const metric = (x: Draft) => x.results?.h72?.impressions ?? x.results?.h24?.impressions ?? x.impressions ?? null
  const mine = metric(d)
  if (mine == null) return null
  const earlier = all.filter((x) => x.id !== d.id && x.status === 'published' && x.published_at && d.published_at && x.published_at < d.published_at).map(metric).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b)
  if (earlier.length < 3) return null
  const mid = earlier[Math.floor(earlier.length / 2)]
  return mid ? Math.round((mine / mid) * 10) / 10 : null
}

export const latestResult = (d: Draft) => d.results?.h72 || d.results?.h24 || null

// ── times Spool works (the pod's schedules run on India time) ────────────────

/** "10:40" on India time, shown on their clock. */
export function fromIST(hhmm: string, tz?: string | null): string {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const ist = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h - 5, m - 30))
  return ist.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined })
}

/** When the daily nudge goes out: half an hour before their posting time. */
export function nudgeTime(postingTime?: string | null): string {
  const [h, m] = (postingTime || '08:30').split(':').map(Number)
  const t = (h * 60 + m - 30 + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
