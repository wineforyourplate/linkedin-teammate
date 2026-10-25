import { motion } from 'motion/react'
import { usePod } from '@/lib/data'
import type { Draft } from '@/lib/types'
import type { ComposeStart } from '@/app/Composer'

/* Approvals that teach. One tap says what's off with a draft: the first three open it
   in the composer with that instruction already sent; "Not my topic" drops it and
   remembers. Edits there become voice rules when the post is approved (post-for-me). */

const CHIPS = [
  { label: 'Shorter', ask: 'Make it shorter. Keep what matters.' },
  { label: 'More like me', ask: 'This doesn’t sound enough like me. Make it more like how I write.' },
  { label: 'Less salesy', ask: 'It reads salesy. Take the pitch out and keep the substance.' },
] as const

export function TeachChips({ d, compose, onDropped, dark = false }: { d: Draft; compose: (s: ComposeStart) => void; onDropped?: () => void; dark?: boolean }) {
  const pod = usePod()
  const notMine = async () => {
    await pod.update('drafts', d.id, { status: 'killed' })
    await pod.create('facts', { section: 'preferences', kind: 'fact', label: 'Not my topic', value: (d.title || d.body || '').split('\n')[0].slice(0, 200), source: 'you said so', confidence: 1 })
    onDropped?.()
  }
  const cls = dark ? 'bg-white/5 text-on-dark ring-white/15 hover:bg-white/10' : 'bg-surface text-ink ring-line hover:bg-lavender'
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Tell Spool what’s off">
      {CHIPS.map((c) => (
        <motion.button key={c.label} type="button" whileTap={{ scale: 0.95 }} onClick={() => compose({ draft: d, ask: c.ask })} className={`rounded-pill px-3 py-1.5 text-[12.5px] ring-1 ${cls}`}>{c.label}</motion.button>
      ))}
      <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => void notMine()} className={`rounded-pill px-3 py-1.5 text-[12.5px] ring-1 ${cls}`}>Not my topic</motion.button>
    </div>
  )
}

/** What Spool learned from them this week, in its own words (newest voice and preference facts). */
export function useLearned(days = 7) {
  const { facts } = usePod()
  const from = Date.now() - days * 86400e3
  return facts
    .filter((f) => (f.section === 'voice' || f.section === 'preferences') && f.kind !== 'question' && /your edits|you said so|you told me/i.test(f.source || '') && new Date(f.created_at || 0).getTime() > from)
    .slice(0, 3)
    .map((f) => (f.label === 'Not my topic' ? `not “${(f.value || '').slice(0, 40)}”` : f.label))
}

export function LearnedLine({ className }: { className?: string }) {
  const learned = useLearned()
  if (!learned.length) return null
  return (
    <p className={className ?? 'text-[13px] text-ink-2'}>
      Spool learned this week: {learned.map((l, i) => <span key={i}>{i ? ' · ' : ''}<span className="text-ink" style={{ fontWeight: 480 }}>{l}</span></span>)}
    </p>
  )
}
