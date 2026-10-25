import { createContext, useContext, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CalendarClock, Check, Feather, Flame, Minus } from 'lucide-react'
import { useChat } from '@/lib/chat'
import { usePod } from '@/lib/data'
import { renderMarkdown } from '@/lib/markdown'
import { fmtSlot, nextSlot } from '@/lib/time'
import { cn } from '@/lib/utils'

/* Small interactive pieces inside Spool's replies. Spool writes a fenced block:

     ```widget
     {"kind": "hooks", "options": ["…", "…", "…"]}
     ```

   and the chat shows it as something to tap instead of text to read. Kinds:
   - hooks: pick one of three first lines
   - tone: Calmer · As is · Bolder
   - choices: a question with a few answers
   - schedule: "Ready to go out at Tue 08:30" with Approve (only inside the composer)
   Anything picked becomes a message from them, and the widget folds into a one-line
   receipt. Pickers, not dropdowns; typing still goes through the chat box. */

export type Widget =
  | { kind: 'hooks'; options: string[] }
  | { kind: 'tone' }
  | { kind: 'choices'; question?: string; options: string[] }
  | { kind: 'schedule'; slot?: string }

/** What the composer lets widgets do (schedule the draft being written). */
interface WidgetActions {
  schedule?: (slot: string) => Promise<void>
}
const Ctx = createContext<WidgetActions>({})
export const WidgetActionsProvider = ({ value, children }: { value: WidgetActions; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>

type Part = { type: 'text'; text: string } | { type: 'widget'; widget: Widget }

function parse(text: string): Part[] {
  const parts: Part[] = []
  const re = /```widget\s*([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) })
    try {
      const w = JSON.parse(m[1]) as Widget
      if (w && typeof w === 'object' && 'kind' in w) parts.push({ type: 'widget', widget: w })
    } catch {
      parts.push({ type: 'text', text: m[0] })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts.filter((p) => p.type === 'widget' || p.text.trim())
}

/** A reply from Spool: markdown, with any widgets drawn in place. */
export function AssistantText({ id, text }: { id: string; text: string }) {
  const parts = parse(text)
  return (
    <div className="flex flex-col gap-3">
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <div key={i} className="chat-md text-[14px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.text) }} />
        ) : (
          <WidgetView key={i} id={`${id}:${i}`} w={p.widget} />
        ),
      )}
    </div>
  )
}

const used = new Map<string, string>() // widget id → receipt, kept for this session

function WidgetView({ id, w }: { id: string; w: Widget }) {
  const chat = useChat()
  const actions = useContext(Ctx)
  const { profile, drafts } = usePod()
  const [receipt, setReceipt] = useState<string | null>(used.get(id) || null)
  const done = (label: string, message?: string) => {
    used.set(id, label)
    setReceipt(label)
    if (message) void chat.send(message)
  }
  if (receipt) return <p className="flex items-center gap-1.5 text-[12.5px] text-slate"><Check className="size-3.5 text-primary" /> {receipt}</p>
  const busy = chat.running

  if (w.kind === 'hooks')
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">Pick a first line</p>
        {w.options.slice(0, 4).map((o, i) => (
          <motion.button key={i} type="button" whileTap={{ scale: 0.98 }} disabled={busy} onClick={() => done(`First line: “${o}”`, `Use this first line: “${o}”`)} className="rounded-xl bg-surface p-3 text-left text-[14.5px] leading-snug text-ink ring-1 ring-line transition-colors hover:bg-lavender hover:ring-primary/40 disabled:opacity-50">
            {o}
          </motion.button>
        ))}
      </div>
    )
  if (w.kind === 'tone')
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">How should it feel?</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Calmer', icon: Feather, msg: 'Make it calmer.' },
            { label: 'As is', icon: Minus, msg: '' },
            { label: 'Bolder', icon: Flame, msg: 'Make it bolder.' },
          ].map((t) => (
            <motion.button key={t.label} type="button" whileTap={{ scale: 0.96 }} disabled={busy} onClick={() => done(`Tone: ${t.label.toLowerCase()}`, t.msg || undefined)} className="flex flex-col items-center gap-1 rounded-xl bg-surface py-2.5 text-[13.5px] text-ink ring-1 ring-line hover:bg-lavender disabled:opacity-50">
              <t.icon className="size-4 text-primary" /> {t.label}
            </motion.button>
          ))}
        </div>
      </div>
    )
  if (w.kind === 'choices')
    return (
      <div className="flex flex-col gap-2">
        {w.question ? <p className="text-[14px] text-ink">{w.question}</p> : null}
        <div className="flex flex-wrap gap-2">
          {w.options.slice(0, 6).map((o) => (
            <motion.button key={o} type="button" whileTap={{ scale: 0.96 }} disabled={busy} onClick={() => done(o, o)} className="rounded-pill bg-primary/8 px-3.5 py-2 text-[13.5px] text-ink hover:bg-primary/14 disabled:opacity-50">
              {o}
            </motion.button>
          ))}
        </div>
      </div>
    )
  if (w.kind === 'schedule') {
    const taken = drafts.filter((d) => d.status === 'approved' && d.scheduled_for).map((d) => d.scheduled_for as string)
    const slot = w.slot && new Date(w.slot).getTime() > Date.now() ? w.slot : nextSlot({ days: profile?.posting_days, time: profile?.posting_time, tz: profile?.timezone, taken })
    return <ScheduleCard slot={slot} can={!!actions.schedule} onApprove={async (s) => { await actions.schedule?.(s); done(`Scheduled for ${fmtSlot(s, profile?.timezone)}`) }} tz={profile?.timezone} />
  }
  return null
}

function ScheduleCard({ slot, can, onApprove, tz }: { slot: string; can: boolean; onApprove: (slot: string) => Promise<void>; tz?: string | null }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-lavender p-3.5">
      <CalendarClock className="size-5 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-ink" style={{ fontWeight: 500 }}>Ready to go out {fmtSlot(slot, tz)}</p>
        <p className="text-[12px] text-ink-2">Your next free slot. You can still change it in Posts.</p>
      </div>
      {can ? (
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onApprove(slot); setBusy(false) }} className={cn('rounded-pill bg-primary px-4 py-2 text-[13.5px] text-white hover:bg-primary-hover disabled:opacity-60')}>
          {busy ? 'Scheduling…' : 'Approve and schedule'}
        </button>
      ) : (
        <span className="text-[12.5px] text-ink-2">Approve it from the composer</span>
      )}
    </div>
  )
}
