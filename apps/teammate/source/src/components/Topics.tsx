import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, Plus, X } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { ago } from '@/lib/time'
import type { Signal, Topic } from '@/lib/types'
import { Button, Eyebrow } from '@/components/ui'
import { cn } from '@/lib/utils'

/* The person's topics, as fixed buttons. Adding one starts its research (the
   on-topic-added schedule): what's landing, what's falling flat and what people are
   asking this month, every item dated and linked. The same topics drive post ideas
   and the Engage tab. */

const fresh = (t: Topic) => !!t.created_at && Date.now() - new Date(t.created_at).getTime() < 15 * 60 * 1000
export const isResearching = (t: Topic) => t.research_status === 'running' || (t.research_status === 'idle' && fresh(t))
const clean = (s: string) => s.replace(/[[\]]/g, '')

export function Topics({ intro }: { intro?: string }) {
  const pod = usePod()
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const topics = pod.topics
  useWaitFor(topics.some(isResearching), ['topics', 'drafts'], 5000, 15 * 60 * 1000)
  const add = async () => {
    const n = name.trim()
    if (!n) return
    await pod.create('topics', { name: n, source: 'you', status: 'active', research_status: 'idle', position: topics.length })
    setName('')
    setAdding(false)
  }
  const current = topics.find((t) => t.id === open)
  return (
    <section aria-label="Your topics" className="flex flex-col gap-3">
      {intro ? <p className="text-[14px] text-ink-2">{intro}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {topics.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            whileTap={{ scale: 0.96 }}
            aria-pressed={open === t.id}
            onClick={() => setOpen((o) => (o === t.id ? null : t.id))}
            className={cn('inline-flex min-h-10 items-center gap-2 rounded-pill px-4 text-[14px] transition-colors', open === t.id ? 'bg-primary text-on-primary' : t.status === 'paused' ? 'bg-primary/5 text-slate' : 'bg-primary/10 text-ink hover:bg-primary/15')}
            style={{ fontWeight: 430 }}
          >
            <span className={cn('size-1.5 rounded-full', isResearching(t) ? 'animate-pulse bg-periwinkle' : t.research_status === 'done' ? 'bg-[#2e9d68]' : t.research_status === 'failed' ? 'bg-[#d68a2e]' : 'bg-slate/40')} aria-hidden />
            {t.name}
          </motion.button>
        ))}
        {adding ? (
          <form className="inline-flex items-center gap-1 rounded-pill bg-surface py-1 pl-4 pr-1 ring-1 ring-primary" onSubmit={(e) => { e.preventDefault(); void add() }}>
            <label htmlFor="new-topic" className="sr-only">New topic</label>
            <input id="new-topic" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI agents in sales" className="w-48 bg-transparent text-[14px] text-ink placeholder:text-slate focus:outline-none" />
            <Button size="sm" variant="primary" type="submit" disabled={!name.trim()}>Add</Button>
            <button type="button" onClick={() => { setAdding(false); setName('') }} className="grid size-8 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label="Cancel"><X className="size-4" /></button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-pill px-4 text-[14px] text-primary ring-1 ring-primary/30 hover:bg-primary/8">
            <Plus className="size-4" /> Add a topic
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">{current ? <TopicDetail key={current.id} t={current} onClose={() => setOpen(null)} /> : null}</AnimatePresence>
    </section>
  )
}

function TopicDetail({ t, onClose }: { t: Topic; onClose: () => void }) {
  const pod = usePod()
  const chat = useChat()
  const s = t.signals || {}
  const researching = isResearching(t)
  const talk = (text: string, about: string) => void chat.send(text, { fresh: true, context: clean(`Topic ${t.id} "${t.name}" · ${about}`) })
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-surface p-5 ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] text-ink" style={{ fontWeight: 470 }}>{t.name}</p>
          <p className="mt-1 text-[13px] text-slate">
            {researching ? 'Researching this month’s conversation…' : t.researched_at ? `Researched ${ago(t.researched_at)} · last 30 days only` : t.research_status === 'failed' ? 'Research didn’t finish' : 'Not researched yet'}
            {t.why ? ` · ${t.why}` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label="Close"><X className="size-4" /></button>
      </div>
      {t.summary ? <p className="mt-3 text-[15px] text-ink">{t.summary}</p> : null}
      {s.working?.length || s.not?.length || s.asking?.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Signals title="Landing" items={s.working} />
          <Signals title="Falling flat" items={s.not} />
          <Signals title="People are asking" items={s.asking} />
        </div>
      ) : null}
      {t.angles?.length ? (
        <div className="mt-5">
          <Eyebrow>Posts I’d write from this</Eyebrow>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {t.angles.map((a) => (
              <li key={a.title} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] text-ink" style={{ fontWeight: 460 }}>{a.title}</p>
                  {a.from ? <p className="mt-0.5 text-[13px] text-ink-2">from {a.from}</p> : null}
                </div>
                <Button size="sm" variant="tint" className="shrink-0" onClick={() => talk(`Let’s write this one: “${a.title}”. Ask me a question or two to get my angle, then draft it here.`, 'post angle')}>Talk it through</Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => talk(`Let’s talk about “${t.name}”. What’s worth saying about it this week?`, 'talk about the topic')}>Talk about this topic</Button>
        <Button size="sm" disabled={researching} onClick={() => { void pod.update('topics', t.id, { research_status: 'running' }); void chat.task(`[research] Topic ${t.id}: "${t.name}". Research it again now.`) }}>Research again</Button>
        <Button size="sm" variant="ghost" onClick={() => void pod.update('topics', t.id, { status: t.status === 'paused' ? 'active' : 'paused' })}>{t.status === 'paused' ? 'Resume' : 'Pause'}</Button>
        <Button size="sm" variant="ghost" onClick={() => { onClose(); void pod.remove('topics', t.id) }}>Remove</Button>
      </div>
    </motion.div>
  )
}

function Signals({ title, items }: { title: string; items?: Signal[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      {items?.length ? (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map((x, i) => (
            <li key={i} className="text-[13.5px] leading-snug">
              <p className="text-ink">{x.text}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-slate">
                <span>{x.source}</span>
                <span>{x.date}</span>
                {x.metric ? <span>{x.metric}</span> : null}
                {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">source <ExternalLink className="size-3" /></a> : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-slate">Nothing recent enough.</p>
      )}
    </div>
  )
}
