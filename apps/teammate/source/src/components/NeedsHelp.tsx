import { useState } from 'react'
import { Button } from '@/components/ui'
import { startConnect } from '@/lib/connect'
import type { Help } from '@/lib/health'
import type { AppView } from '@/app/AppShell'

/* The top of Home when something only they can fix has stopped the work: one row each, what
   stopped and what it holds up, with the one tap that fixes it. Gone the moment it's fixed. */

export function NeedsHelp({ items, go, browser }: { items: Help[]; go: (v: AppView, anchor?: string) => void; browser: (h: Help) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  if (!items.length) return null

  const act = async (h: Help) => {
    if (h.act.kind === 'go') return go(h.act.view, h.act.anchor)
    if (h.act.kind === 'browser') return browser(h)
    setBusy(h.key)
    const err = await startConnect('linkedin')
    if (err) setNote((n) => ({ ...n, [h.key]: err }))
    setBusy(null)
  }

  return (
    <section aria-labelledby="needs-help" className="rounded-[22px] bg-peach p-1.5">
      <h2 id="needs-help" className="px-3 pb-1.5 pt-2 text-[12px] uppercase tracking-[0.06em] text-[#9a4417]" style={{ fontWeight: 650 }}>Needs your help</h2>
      <ul className="flex flex-col gap-1">
        {items.map((h) => (
          <li key={h.key} className="rounded-2xl bg-white/75 px-3 py-3">
            <div className="flex items-start gap-3 sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-peach/70 text-[18px]" aria-hidden>{h.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ink" style={{ fontWeight: 580 }}>{h.title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{h.detail}</p>
                <div className="mt-2.5 sm:hidden"><Button variant="primary" size="sm" busy={busy === h.key} onClick={() => void act(h)}>{h.act.label}</Button></div>
              </div>
              <div className="hidden shrink-0 sm:block"><Button variant="primary" size="sm" busy={busy === h.key} onClick={() => void act(h)}>{h.act.label}</Button></div>
            </div>
            {note[h.key] ? <p className="mt-2 pl-[52px] text-[13px] text-[#8a4b00]">{note[h.key]}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
