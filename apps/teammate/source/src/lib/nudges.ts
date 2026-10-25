import { useState } from 'react'
import { usePod } from '@/lib/data'
import { startConnect } from '@/lib/connect'
import { useHelp } from '@/lib/health'
import type { AppView } from '@/app/AppShell'

/* What Spool brings up from the corner, one at a time, built from what the pod already knows:
   people talking to them, results worth knowing, work ready for them, people to add to their
   world, questions, and anything at risk. Specific or nothing: every line names a person, a number or a thing. "Not now"
   quiets that one until tomorrow. */

export type NudgeMood = 'happy' | 'excited' | 'curious' | 'proud' | 'worried' | 'sleepy'
export interface Nudge {
  key: string
  kind: string
  mood: NudgeMood
  text: string
  go?: { label: string; view: AppView; anchor?: string; run?: () => void }
  options?: { label: string; pick: () => void }[]
}

const KEY = 'spool.notnow'
const today = () => new Date().toISOString().slice(0, 10)
function readSnoozed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as { day: string; keys: string[] } | null
    return v && v.day === today() ? v.keys : []
  } catch {
    return []
  }
}
const agoMin = (at?: string | null) => (at ? Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000)) : null)
const fmtAgo = (m: number | null) => { if (m == null) return ''; if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`; const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`; const d = Math.round(m / 1440); return d === 1 ? 'yesterday' : `${d} days ago` }
const first = (n?: string | null) => (n || 'Someone').split(' ')[0]

export function useNudges() {
  const pod = usePod()
  const help = useHelp()
  const [snoozed, setSnoozed] = useState<string[]>(readSnoozed)
  const later = (key: string) => {
    const next = [...snoozed, key]
    setSnoozed(next)
    try { localStorage.setItem(KEY, JSON.stringify({ day: today(), keys: next })) } catch { /* fine */ }
  }
  const out: Nudge[] = []
  const eng = pod.engagements
  const recent = (at?: string | null, hours = 48) => !!at && Date.now() - new Date(at).getTime() < hours * 3600e3

  // anything that stopped and only they can fix, first
  for (const h of help) {
    const go = h.act.kind === 'reconnect'
      ? { label: h.act.label, view: 'home' as AppView, run: () => void startConnect('linkedin') }
      : h.act.kind === 'browser'
        ? { label: h.act.label, view: 'home' as AppView }
        : { label: h.act.label, view: h.act.view, anchor: h.act.anchor }
    out.push({ key: `help:${h.key}`, kind: 'Needs your help', mood: 'worried', text: `${h.title}. ${h.detail}`, go })
  }

  // people talking to them, first
  const directed = eng.filter((e) => (e.status === 'proposed' || e.status === 'liked') && (e.method === 'thread' || e.method === 'own_post'))
  if (directed.length) {
    const e = directed[0]
    const rest = directed.length - 1
    out.push({
      key: `reply:${e.id}`,
      kind: 'Someone is talking to you',
      mood: 'happy',
      text: `${e.author_name || 'Someone'} ${e.method === 'own_post' ? 'commented on your post' : 'replied to your comment'}${rest ? `, and ${rest} more ${rest === 1 ? 'person is' : 'people are'} waiting` : ''}. Answer while they’re still around?`,
      go: { label: rest ? 'Answer them' : 'Answer', view: 'engage' },
    })
  }

  // authors who replied and then looked them up
  const warm = eng.filter((e) => e.status === 'commented' && e.outcome?.author_replied && recent(e.outcome?.checked_at || e.done_at, 72))
  const looked = warm.find((e) => /profile/i.test(e.outcome?.note || ''))
  if (looked) {
    out.push({ key: `warm:${looked.id}`, kind: 'Someone warmed up', mood: 'happy', text: `${looked.author_name} replied to your comment, then looked at your profile. A good moment to connect, with a note about that thread.`, go: { label: 'See the thread', view: 'engage' } })
  }

  // fresh comments ready to approve
  const ready = eng.filter((e) => (e.status === 'proposed' || e.status === 'liked') && e.method !== 'thread' && e.method !== 'own_post' && e.comment_draft)
  if (ready.length) {
    const freshest = ready.map((e) => agoMin(e.posted_at)).filter((m): m is number => m != null).sort((a, b) => a - b)[0] ?? null
    const stale = freshest != null && freshest > 12 * 60
    out.push(stale
      ? { key: `batch:${ready.length}:${ready[0].id}`, kind: 'Still waiting', mood: 'curious', text: `${ready.length} comment${ready.length === 1 ? ' is' : 's are'} still waiting, but the newest post is from ${fmtAgo(freshest)}, past its best. Post anyway, or skip and let me find fresh ones?`, go: { label: 'Decide', view: 'engage' } }
      : { key: `batch:${ready.length}:${ready[0].id}`, kind: 'Fresh conversations', mood: 'excited', text: `${ready.length} comment${ready.length === 1 ? '' : 's'} ready for you${freshest != null ? `, the freshest on a post from ${fmtAgo(freshest)}` : ''}. Fresh threads are where people answer.`, go: { label: 'Review them', view: 'engage' } })
  }

  // people the finding runs would add to their world: they decide, nothing joins on its own
  const sugg = pod.world.filter((w) => w.status === 'suggested')
  if (sugg.length) {
    const n = sugg.length
    const by = (src: string) => sugg.filter((w) => w.source === src).length
    const main = (['repeat', 'replied', 'linkedin'] as const).reduce((a, b) => (by(b) > by(a) ? b : a), 'repeat')
    const who = n === 1 ? first(sugg[0].name) : `${n} people`
    const text = main === 'replied'
      ? `${who} talked to you this week and ${n === 1 ? 'isn’t' : 'aren’t'} in your world yet. Add them?`
      : main === 'linkedin'
        ? `LinkedIn keeps putting ${n === 1 ? first(sugg[0].name) : `${n} people`} next to the people you watch. Add them to your world?`
        : `${who} kept showing up in your topics this week. Add them to your world?`
    out.push({ key: `world:${n}:${sugg[0].id}`, kind: 'Your world', mood: 'curious', text, go: { label: n === 1 ? 'See who' : `See all ${n}`, view: 'personal', anchor: 'world' } })
  }

  // what's working, from their own read-backs
  const week = eng.filter((e) => e.status === 'commented' && e.outcome && recent(e.done_at, 7 * 24))
  if (week.length >= 5) {
    const authors = week.filter((e) => e.outcome?.author_replied)
    const small = authors.filter((e) => (e.author_followers ?? 0) > 0 && (e.author_followers ?? 0) < 35000).length
    out.push({
      key: `working:${week.length}:${authors.length}`,
      kind: 'What’s working',
      mood: 'proud',
      text: `${authors.length} of your last ${week.length} comments got a reply from the author${authors.length && small === authors.length ? `, all from people under 35K followers. I’m leaning your batches toward people like them.` : '.'}`,
      go: { label: 'See the scorecard', view: 'engage' },
    })
  }

  // a post ready for them
  const draft = pod.drafts.find((d) => d.status === 'ready')
  if (draft) {
    out.push({ key: `draft:${draft.id}`, kind: 'Ready for you', mood: 'curious', text: `Your post “${(draft.title || draft.body || '').split('\n')[0].slice(0, 70)}” is ready. One look before it goes out?`, go: { label: 'Look at it', view: 'posts' } })
  }

  // one question at a time, answered right here when it has choices
  const q = pod.facts.find((f) => f.kind === 'question')
  if (q) {
    const opts = (q.options || []).filter((o): o is string => typeof o === 'string').slice(0, 4)
    out.push({
      key: `q:${q.id}`,
      kind: 'Quick question',
      mood: 'curious',
      text: q.label,
      ...(opts.length
        ? { options: opts.map((o) => ({ label: o, pick: () => void pod.update('facts', q.id, { value: o, kind: 'fact', source: 'you said so' }) })) }
        : { go: { label: 'Answer it', view: 'personal' as AppView } }),
    })
  }

  // a new recommendation
  const rec = pod.recommendations.find((r) => r.status === 'new')
  if (rec) out.push({ key: `rec:${rec.id}`, kind: 'An idea', mood: 'curious', text: rec.title, go: { label: 'Tell me more', view: 'recommended' } })

  const list = out.filter((n) => !snoozed.includes(n.key))
  return { list, later }
}

export const REST: Nudge = { key: 'rest', kind: '', mood: 'sleepy', text: 'That’s everything worth your time right now. I’ll tap you when something is.' }
