import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useChat } from '@/lib/chat'
import { REST, useNudges, type Nudge, type NudgeMood } from '@/lib/nudges'
import { cn } from '@/lib/utils'
import { CastMascot, type Mood } from '@/components/cast/CastMascot'
import type { AppView } from '@/app/AppShell'

/* Spool in the corner: where suggestions and notifications live, one at a time, with a mood
   on its face. Tap Spool for everything waiting and to ask anything. It learned from Clippy:
   it never opens on its own on a phone, opens once per visit on a computer, never while the
   chat is open, and "Not now" means not today. */

const FACE: Record<NudgeMood, Mood> = { happy: 'happy', excited: 'surprised', curious: 'listening', proud: 'celebrate', worried: 'worried', sleepy: 'sleepy' }
const ICON: Record<NudgeMood, string> = { happy: '💬', excited: '⚡', curious: '❓', proud: '📈', worried: '🔧', sleepy: '💤' }
const SHOWN = 'spool.shown'

export function Buddy({ go }: { go: (v: AppView, anchor?: string) => void }) {
  const chat = useChat()
  const { list, later } = useNudges()
  const [open, setOpen] = useState(false)
  const [stack, setStack] = useState(false)
  const [ask, setAsk] = useState('')
  const top: Nudge = list[0] || REST
  const small = typeof window !== 'undefined' && window.innerWidth < 768

  // a computer gets one unprompted hello per visit; a phone never does
  const any = list.length > 0
  useEffect(() => {
    if (!any || window.innerWidth < 768) return
    try { if (sessionStorage.getItem(SHOWN)) return } catch { /* fine */ }
    const t = window.setTimeout(() => {
      setOpen(true)
      try { sessionStorage.setItem(SHOWN, '1') } catch { /* fine */ }
    }, 1200)
    return () => window.clearTimeout(t)
  }, [any])

  if (chat.isOpen) return null
  const act = (n: Nudge) => { if (n.go?.run) n.go.run(); else if (n.go) go(n.go.view, n.go.anchor); setOpen(false); setStack(false) }
  const send = () => { const t = ask.trim(); if (!t) return; setAsk(''); setStack(false); chat.open(); void chat.send(t) }
  const mood: Mood = open || stack ? FACE[top.mood] : list.length ? 'listening' : 'idle'

  return (
    <div className="pointer-events-none fixed bottom-[88px] right-3 z-30 flex flex-col items-end gap-2 md:bottom-5 md:right-6">
      <AnimatePresence>
        {stack ? (
          <motion.div key="stack" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="pointer-events-auto flex max-h-[60vh] w-[min(360px,calc(100vw-24px))] flex-col gap-1 overflow-auto rounded-2xl bg-surface p-2 shadow-[0_1px_0_var(--color-line),0_18px_40px_-22px_rgba(30,26,43,.55)]" role="dialog" aria-label="Everything Spool has for you">
            {list.length ? list.map((n) => (
              <button key={n.key} type="button" onClick={() => (n.go ? act(n) : (setStack(false), setOpen(true)))} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left hover:bg-canvas">
                <span className="text-[17px] leading-6" aria-hidden>{ICON[n.mood]}</span>
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-[0.05em] text-slate" style={{ fontWeight: 600 }}>{n.kind}</span>
                  <span className="block text-[13.5px] leading-snug text-ink">{n.text}</span>
                </span>
              </button>
            )) : <p className="p-3 text-[14px] text-ink-2">{REST.text}</p>}
            <div className="mt-1 flex gap-2 border-t border-line p-2">
              <label className="sr-only" htmlFor="ask-spool">Ask Spool anything</label>
              <input id="ask-spool" value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask Spool anything" className="h-10 min-w-0 flex-1 rounded-pill bg-canvas px-4 text-[14px] text-ink ring-1 ring-line focus:outline-none focus:ring-ink" />
              <button type="button" onClick={send} className="h-10 rounded-pill bg-primary px-4 text-[14px] text-white">Ask</button>
            </div>
          </motion.div>
        ) : open ? (
          <motion.div key={top.key} initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} style={{ transformOrigin: '100% 100%' }} className="pointer-events-auto w-[min(330px,calc(100vw-24px))] rounded-[18px_18px_6px_18px] bg-surface p-3.5 shadow-[0_1px_0_var(--color-line),0_18px_40px_-22px_rgba(30,26,43,.55)]" role="status" aria-live="polite">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.05em] text-slate" style={{ fontWeight: 600 }}>{top.kind}</span>
              <button type="button" onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-full text-slate hover:bg-canvas" aria-label="Hide"><X className="size-3.5" /></button>
            </div>
            <p className="mb-3 mt-1 text-[14.5px] leading-snug text-ink">{top.text}</p>
            <div className="flex flex-wrap gap-1.5">
              {top.options?.map((o) => <button key={o.label} type="button" onClick={() => { o.pick(); setOpen(false) }} className="h-9 rounded-pill bg-canvas px-3.5 text-[13.5px] text-ink ring-1 ring-line hover:ring-ink/40">{o.label}</button>)}
              {top.go ? <button type="button" onClick={() => act(top)} className="h-9 rounded-pill bg-primary px-4 text-[13.5px] text-white">{top.go.label}</button> : null}
              {top.key !== REST.key ? <button type="button" onClick={() => { later(top.key); if (list.length <= 1) setOpen(false) }} className="h-9 rounded-pill px-3 text-[13.5px] text-ink-2 hover:bg-canvas">Not now</button> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => { if (open) { setOpen(false); setStack(true) } else if (stack) setStack(false); else setOpen(true) }}
        className="pointer-events-auto relative rounded-full focus-visible:outline-offset-4"
        aria-label={list.length ? `Spool: ${list.length} thing${list.length === 1 ? '' : 's'} for you` : 'Spool'}
        aria-expanded={open || stack}
      >
        <CastMascot size={small ? 66 : 84} mood={mood} sleepAfter={0} quiet pokable={false} className="drop-shadow-[0_10px_14px_rgba(30,26,43,.18)]" />
        {list.length && !open && !stack ? <span className={cn('absolute right-2 top-2 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#e8661f] px-1.5 text-[12px] text-white ring-[3px] ring-canvas')} style={{ fontWeight: 700 }}>{list.length}</span> : null}
      </button>
    </div>
  )
}
