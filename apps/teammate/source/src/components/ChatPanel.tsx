import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ArrowUp, ExternalLink, Loader2, Plus, X } from 'lucide-react'
import { useChat } from '@/lib/chat'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { CastMascot } from './cast/CastMascot'
import { AssistantText } from './ChatWidgets'

const SUGGEST = ['What should I post about this week?', 'What did you do on my account today?', 'How can my profile work harder?']

/** The conversation itself: messages, steps and sign-in prompts. Used by the side panel and the full-screen composer. */
export function ChatThread({ empty, className }: { empty?: ReactNode; className?: string }) {
  const chat = useChat()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [chat.blocks.length, chat.running])
  return (
    <div className={cn('flex-1 overflow-y-auto px-5 py-5', className)} aria-live="polite">
      {!chat.blocks.length ? (
        empty ?? null
      ) : (
        <div className="flex flex-col gap-4">
            {chat.blocks.map((b) => {
              if (b.kind === 'user') return <p key={b.id} className="ml-8 self-end rounded-md bg-primary px-4 py-2.5 text-[14px] text-white">{b.text}</p>
              if (b.kind === 'text') return <AssistantText key={b.id} id={b.id} text={b.text} />
              if (b.kind === 'steps')
                return (
                  <ul key={b.id} className="flex flex-col gap-1 border-l border-line pl-3">
                    {b.steps.map((s) => (
                      <li key={s.id} className={cn('text-[12px]', s.failed ? 'text-alert' : 'text-slate')}>{s.text}</li>
                    ))}
                  </ul>
                )
              const link = !b.done ? chat.signInLink(b.toolCallId) : null
              return b.done ? (
                <p key={b.id} className="text-[12px] text-slate">Signed in to {b.origin}</p>
              ) : (
                <div key={b.id} className="flex flex-col gap-3 rounded-md bg-lavender p-4">
                  <p className="text-[14px] text-ink">Sign in to <strong style={{ fontWeight: 500 }}>{b.origin}</strong> in your own Lemma browser. You type your password there; I never see it.</p>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-fit items-center gap-2 rounded-pill bg-primary px-4 text-[14px] text-white">
                      Open my browser <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              )
            })}
            {chat.running ? (
              <p className="flex items-center gap-2 text-[12px] text-slate"><Loader2 className="size-3 animate-spin" /> Working</p>
            ) : null}
            <div ref={end} />
        </div>
      )}
      {chat.error ? <p className="mt-4 rounded-md bg-alert-soft p-3 text-[13px] text-alert">{chat.error}</p> : null}
    </div>
  )
}

/** Where they type to the teammate. Quick replies sit above the box when given. */
export function ChatInput({ placeholder = 'Ask or tell me anything', quick = [], value, onChange, inputRef }: { placeholder?: string; quick?: string[]; value?: string; onChange?: (v: string) => void; inputRef?: RefObject<HTMLTextAreaElement | null> }) {
  const chat = useChat()
  const [own, setOwn] = useState('')
  const text = value ?? own
  const setText = onChange ?? setOwn
  const send = (t: string) => { if (t.trim()) { void chat.send(t); setText('') } }
  return (
    <form className="border-t border-line p-4" onSubmit={(e) => { e.preventDefault(); send(text) }}>
      {quick.length ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} disabled={chat.running} className="rounded-pill bg-primary/8 px-3 py-1.5 text-[13px] text-ink hover:bg-primary/12 disabled:opacity-50">{q}</button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2 rounded-xl bg-canvas p-2 ring-1 ring-line focus-within:ring-primary">
        <label htmlFor="ask" className="sr-only">Message your teammate</label>
        <textarea
          id="ask"
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }}
          placeholder={placeholder}
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] text-ink placeholder:text-slate focus:outline-none"
        />
        <button type="submit" disabled={!text.trim()} className="grid size-9 place-items-center rounded-full bg-primary text-white disabled:opacity-40" aria-label="Send">
          <ArrowUp className="size-4" />
        </button>
      </div>
    </form>
  )
}

/** The teammate beside every view. `docked`: always visible on wide screens (the current app); otherwise it opens over the page. */
export function ChatPanel({ docked = true }: { docked?: boolean }) {
  const chat = useChat()
  return (
    <aside
      className={cn(
        'z-40 flex-col border-l border-line bg-surface',
        chat.isOpen
          ? cn('fixed inset-0 flex md:inset-y-0 md:left-auto md:w-[400px] md:shadow-[-12px_0_40px_rgba(23,23,33,0.12)]', docked && 'xl:sticky xl:top-0 xl:h-screen xl:shadow-none')
          : docked ? 'hidden xl:sticky xl:top-0 xl:flex xl:h-screen xl:w-[360px]' : 'hidden',
      )}
      aria-label="Your teammate"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <CastMascot size={44} mood={chat.running ? 'working' : 'idle'} sleepAfter={0} quiet />
        <div className="flex-1">
          <p className="text-[15px] text-ink" style={{ fontWeight: 480 }}>Spool</p>
          <p className="text-[12px] text-slate">{chat.running ? 'Working…' : 'Your teammate. Ask, or tell it what to change'}</p>
        </div>
        <button type="button" onClick={chat.newChat} className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-primary/8" aria-label="New conversation"><Plus className="size-4" /></button>
        <button type="button" onClick={chat.close} className={cn('grid size-9 place-items-center rounded-full text-ink-2 hover:bg-primary/8', docked && 'xl:hidden')} aria-label="Close"><X className="size-4" /></button>
      </header>
      <ChatThread
        empty={
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-ink-2">I know what’s on your screen, so “this draft” or “these people” works.</p>
            {SUGGEST.map((s) => (
              <button key={s} type="button" onClick={() => void chat.send(s)} className="rounded-md bg-lavender px-4 py-3 text-left text-[14px] text-ink hover:bg-[#e3e2f7]">
                {s}
              </button>
            ))}
          </div>
        }
      />
      <ChatInput />
    </aside>
  )
}
