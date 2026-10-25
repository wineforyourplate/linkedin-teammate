import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { AlignLeft, BarChart3, Check, ChevronLeft, ChevronRight, GalleryHorizontal, Image as ImageIcon, Lightbulb, Link2, MessageCircle, Mic, Newspaper, Pencil, RotateCcw, Scissors, Wand2, Zap, X } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import type { Draft } from '@/lib/types'
import { Button } from '@/components/ui'
import { ChatInput, ChatThread } from '@/components/ChatPanel'
import { CastMascot } from '@/components/cast/CastMascot'
import { PostPreview, useApprove } from '@/views/Today'
import { WidgetActionsProvider } from '@/components/ChatWidgets'
import { cn } from '@/lib/utils'

/* Writing a post, full screen. First: pick a format and say the idea (or start from a
   recommended one). Then a conversation with Spool on the left and the post itself on
   the right, updating as you talk. The draft is a real row: Spool writes into it, you
   can edit it directly, and approving schedules it. On phones, Chat and Preview are
   two tabs. */

export interface ComposeStart {
  idea?: Draft
  draft?: Draft
  /** With a draft: what to ask Spool first ("Make it shorter."), instead of an open question. */
  ask?: string
  /** Prefill the idea ("Another post like …"). */
  seed?: string
}

/* Ways to start when there's no idea yet: each opens the conversation with a draft to
   write into. (These used to be Home's "What do you want to talk about today?") */
const STARTERS = [
  { key: 'happened', label: 'Something happened', icon: Lightbulb, title: 'Something that happened', say: 'Something happened at work that might be worth a post. Ask me what it was, one question at a time, then write it.' },
  { key: 'new', label: 'What’s new in my topics', icon: Newspaper, title: 'What’s new in my topics', say: 'What’s new in my topics this month? Give me the two most interesting things, ask which one I want to react to, then write it.' },
  { key: 'interview', label: 'Interview me', icon: Mic, title: 'From an interview', say: 'I don’t know what to post today. Interview me, one question at a time, then write the post.' },
] as const

const FORMATS = [
  { key: 'text', label: 'Text', icon: AlignLeft },
  { key: 'image', label: 'Image', icon: ImageIcon },
  { key: 'carousel', label: 'Carousel (PDF)', icon: GalleryHorizontal },
  { key: 'poll', label: 'Poll', icon: BarChart3 },
  { key: 'link', label: 'Link + your take', icon: Link2 },
] as const
const QUICK = ['Shorter', 'Stronger first line', 'More personal', 'Add a real number', 'Make it a carousel']

export function Composer({ start, onClose, onDone }: { start: ComposeStart; onClose: () => void; onDone: () => void }) {
  const pod = usePod()
  const chat = useChat()
  const approve = useApprove()
  const p = pod.profile
  const [draftId, setDraftId] = useState<string | null>(start.draft?.id || null)
  const [format, setFormat] = useState<string>(start.draft?.format || start.idea?.format || 'text')
  const [idea, setIdea] = useState(start.idea?.title || start.seed || '')
  const [tab, setTab] = useState<'chat' | 'preview'>('chat')
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const draft = pod.drafts.find((d) => d.id === draftId)
  const opened = useRef(false)
  const [ask, setAsk] = useState('')
  const askBox = useRef<HTMLTextAreaElement>(null)
  const [viewing, setViewing] = useState<number | null>(null) // an older version, by index
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null)
  const pane = useRef<HTMLDivElement>(null)

  // Keep every earlier text: when the body changes, the one before becomes a version.
  const lastBody = useRef<string | null>(null)
  useEffect(() => {
    const body = draft?.body || ''
    if (!draft) return
    const prev = lastBody.current
    lastBody.current = body
    if (prev === null || !prev || prev === body) return
    const versions = [...(draft.versions || []), { at: new Date().toISOString(), body: prev }].slice(-20)
    void pod.update('drafts', draft.id, { versions })
    setViewing(null)
  }, [draft?.body]) // eslint-disable-line react-hooks/exhaustive-deps

  // Select text in the preview to rework just that part.
  const onSelect = () => {
    const s = window.getSelection()
    const text = s?.toString().trim() || ''
    const box = pane.current?.getBoundingClientRect()
    const inPost = !!s?.anchorNode && !!(s.anchorNode.nodeType === 1 ? (s.anchorNode as Element) : s.anchorNode.parentElement)?.closest('[data-post-body]')
    if (!s || text.length < 3 || !box || !s.rangeCount || !inPost) return setSel(null)
    const r = s.getRangeAt(0).getBoundingClientRect()
    setSel({ text: text.slice(0, 400), x: r.left + r.width / 2 - box.left, y: r.top - box.top + (pane.current?.scrollTop || 0) })
  }
  const rework = (how: string) => {
    if (!sel) return
    void chat.send(`${how}: “${sel.text}”`)
    setSel(null)
    window.getSelection()?.removeAllRanges()
  }
  const askAbout = () => {
    if (!sel) return
    setAsk(`About “${sel.text}”: `)
    setSel(null)
    setTab('chat')
    window.setTimeout(() => askBox.current?.focus(), 30)
  }
  useWaitFor(!!draftId && (chat.running || !draft?.body), ['drafts'], 3000, 10 * 60 * 1000)

  // Opening an existing draft: carry on the conversation about it.
  useEffect(() => {
    if (!start.draft || opened.current) return
    opened.current = true
    void chat.send(start.ask || 'Let’s keep working on this draft. What would make it better?', { fresh: true, context: `Composer · Draft ${start.draft.id} · ${start.draft.format || 'text'}` })
  }, [start.draft, start.ask, chat])

  const begin = async () => {
    if (!idea.trim()) return
    let id = start.idea?.id || null
    if (id) await pod.update('drafts', id, { status: 'drafting', format })
    else {
      const row = (await pod.create('drafts', { status: 'drafting', title: idea.trim().slice(0, 120), format, source: 'you' })) as { id?: string; data?: { id?: string } } | null
      id = row?.id || row?.data?.id || null
    }
    if (!id) return
    setDraftId(id)
    void chat.send(`Let’s write a ${FORMATS.find((f) => f.key === format)?.label.toLowerCase()} post: ${idea.trim()}. Ask me a question or two first if you need my angle, then write it.`, { fresh: true, context: `Composer · Draft ${id} · ${format}` })
  }

  const talk = async (st: (typeof STARTERS)[number]) => {
    const row = (await pod.create('drafts', { status: 'drafting', title: st.title, format, source: 'you' })) as { id?: string; data?: { id?: string } } | null
    const id = row?.id || row?.data?.id || null
    if (!id) return
    setDraftId(id)
    void chat.send(`${st.say} Write it as a ${FORMATS.find((f) => f.key === format)?.label.toLowerCase()} post.`, { fresh: true, context: `Composer · Draft ${id} · ${format}` })
  }

  const done = async () => {
    if (!draft) return
    await approve(draft)
    onDone()
  }

  if (!draftId) {
    const recommended = pod.drafts.filter((d) => d.status === 'idea').slice(0, 3)
    return (
      <Frame onClose={onClose} title="New post">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-8 sm:px-8">
          <div className="flex items-end gap-3">
            <CastMascot size={96} mood="listening" sleepAfter={0} className="-mb-2 -ml-3" />
            <h1 className="pb-3 text-[30px] leading-tight text-ink sm:text-[36px]" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em' }}>What are we writing?</h1>
          </div>
          <div>
            <p className="mb-3 text-[14px] text-ink-2">Format</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {FORMATS.map((f) => (
                <motion.button key={f.key} type="button" whileTap={{ scale: 0.96 }} aria-pressed={format === f.key} onClick={() => setFormat(f.key)} className={cn('flex flex-col items-start gap-2 rounded-2xl p-3 text-left text-[14px] ring-1 transition-colors', format === f.key ? 'bg-primary text-on-primary ring-primary' : 'bg-surface text-ink ring-line hover:bg-lavender')}>
                  <f.icon className="size-5" />
                  {f.label}
                </motion.button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="idea" className="mb-3 block text-[14px] text-ink-2">The idea, in a line or two</label>
            <textarea id="idea" value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} autoFocus className="w-full rounded-2xl bg-surface p-4 text-[16px] leading-relaxed text-ink ring-1 ring-line focus:outline-none focus:ring-primary" placeholder="We cut our support backlog in half without hiring. Here’s the boring part nobody talks about." />
            {recommended.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-[13px] text-slate">Or start from:</span>
                {recommended.map((d) => (
                  <button key={d.id} type="button" onClick={() => setIdea(d.title || '')} className="max-w-full truncate rounded-pill bg-primary/8 px-3 py-1 text-[13px] text-ink hover:bg-primary/12">{d.title}</button>
                ))}
              </div>
            ) : null}
          </div>
          <div><Button variant="primary" size="lg" disabled={!idea.trim()} onClick={() => void begin()}>Start writing with Spool</Button></div>
          <div>
            <p className="mb-3 text-[14px] text-ink-2">No idea yet? Start with a conversation</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {STARTERS.map((st) => (
                <motion.button key={st.key} type="button" whileTap={{ scale: 0.97 }} onClick={() => void talk(st)} className="flex min-h-12 items-center gap-2.5 rounded-2xl bg-surface px-4 text-left text-[14px] text-ink ring-1 ring-line hover:bg-lavender">
                  <st.icon className="size-4 shrink-0 text-primary" /> {st.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </Frame>
    )
  }

  return (
    <Frame
      onClose={onClose}
      title={draft?.title || 'New post'}
      right={<Button variant="primary" disabled={!draft?.body || chat.running} onClick={() => void done()}><Check className="size-4" /> Approve and schedule</Button>}
    >
      <div className="flex border-b border-line px-4 lg:hidden">
        {(['chat', 'preview'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('flex-1 py-3 text-[14px] capitalize', tab === t ? 'border-b-2 border-primary text-ink' : 'text-slate')}>{t}</button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(340px,2fr)_minmax(0,3fr)]">
        <section className={cn('min-h-0 flex-col border-line lg:flex lg:border-r', tab === 'chat' ? 'flex' : 'hidden')} aria-label="Conversation">
          <WidgetActionsProvider value={{ schedule: async (slot) => { if (!draft) return; await pod.update('drafts', draft.id, { status: 'approved', approved_at: new Date().toISOString(), scheduled_for: slot }); window.setTimeout(onDone, 900) } }}>
            <ChatThread />
          </WidgetActionsProvider>
          <ChatInput placeholder="Tell Spool what to change" quick={QUICK} value={ask} onChange={setAsk} inputRef={askBox} />
        </section>
        <section ref={pane} onMouseUp={onSelect} onTouchEnd={() => window.setTimeout(onSelect, 50)} className={cn('relative min-h-0 flex-col overflow-y-auto bg-lavender/40 p-5 lg:flex', tab === 'preview' ? 'flex' : 'hidden')} aria-label="Preview">
          {sel && !editing ? (
            <div className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-pill bg-night p-1 text-[12.5px] text-on-dark shadow-[0_8px_24px_rgba(23,23,33,0.3)]" style={{ left: Math.max(120, sel.x), top: Math.max(8, sel.y - 8) }} onMouseUp={(e) => e.stopPropagation()}>
              <SelBtn icon={<Zap className="size-3.5" />} label="Punchier" onClick={() => rework('Make this part punchier')} />
              <SelBtn icon={<Wand2 className="size-3.5" />} label="Simpler" onClick={() => rework('Say this part more simply')} />
              <SelBtn icon={<Scissors className="size-3.5" />} label="Cut it" onClick={() => rework('Cut this part')} />
              <SelBtn icon={<MessageCircle className="size-3.5" />} label="Ask about this" onClick={askAbout} />
            </div>
          ) : null}
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">Preview · {FORMATS.find((f) => f.key === (draft?.format || format))?.label}</p>
            {draft?.versions?.length ? (
              <span className="flex items-center gap-1 text-[12px] text-ink-2">
                <button type="button" disabled={viewing === 0} onClick={() => setViewing((v) => (v === null ? (draft.versions?.length || 1) - 1 : Math.max(0, v - 1)))} className="grid size-7 place-items-center rounded-full hover:bg-primary/8 disabled:opacity-30" aria-label="Earlier version"><ChevronLeft className="size-4" /></button>
                <span className="tabular">v{(viewing ?? draft.versions.length) + 1} of {draft.versions.length + 1}</span>
                <button type="button" disabled={viewing === null} onClick={() => setViewing((v) => (v === null || v + 1 >= (draft.versions?.length || 0) ? null : v + 1))} className="grid size-7 place-items-center rounded-full hover:bg-primary/8 disabled:opacity-30" aria-label="Later version"><ChevronRight className="size-4" /></button>
              </span>
            ) : null}
            {draft?.body ? (
              <button type="button" onClick={() => { setText(draft.body || ''); setEditing((v) => !v) }} className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[13px] text-primary hover:bg-primary/8"><Pencil className="size-3.5" />{editing ? 'Done' : 'Edit the text'}</button>
            ) : null}
          </div>
          {draft && viewing !== null && draft.versions?.[viewing] ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-xl bg-[#fdf3e6] px-3 py-2 text-[13px] text-[#8a4b00]">
                <span>An earlier version</span>
                <button type="button" onClick={() => { void pod.update('drafts', draft.id, { body: draft.versions![viewing].body }); setViewing(null) }} className="inline-flex items-center gap-1 rounded-pill px-2 py-1 hover:bg-[#f6dcb8]"><RotateCcw className="size-3.5" /> Bring this back</button>
              </div>
              <PostPreview d={{ ...draft, body: draft.versions[viewing].body }} name={p?.linkedin_name || p?.display_name || 'You'} headline={p?.headline} photo={p?.photo_url} className="rounded-2xl bg-surface p-5 opacity-80 ring-1 ring-line" />
            </div>
          ) : draft?.body ? (
            editing ? (
              <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => draft && void pod.update('drafts', draft.id, { body: text })} rows={18} className="w-full rounded-2xl bg-surface p-4 text-[15px] leading-relaxed text-ink ring-1 ring-line focus:outline-none focus:ring-primary" aria-label="Post text" />
            ) : (
              <PostPreview d={draft} name={p?.linkedin_name || p?.display_name || 'You'} headline={p?.headline} photo={p?.photo_url} className="rounded-2xl bg-surface p-5 ring-1 ring-line" />
            )
          ) : (
            <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-primary/30 p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <CastMascot size={90} mood="working" sleepAfter={0} quiet />
                <p className="text-[14px] text-ink-2">Your post appears here as Spool writes it.</p>
              </div>
            </div>
          )}
          {draft?.body ? <p className="mt-2 text-right text-[12px] tabular text-slate">{(editing ? text : draft.body).length} / 3,000</p> : null}
        </section>
      </div>
    </Frame>
  )
}

function SelBtn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-white/10">
      {icon} {label}
    </button>
  )
}

function Frame({ title, onClose, right, children }: { title: string; onClose: () => void; right?: ReactNode; children: ReactNode }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col bg-canvas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25 }} role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-primary/8" aria-label="Close"><X className="size-5" /></button>
        <p className="min-w-0 flex-1 truncate text-[15px] text-ink" style={{ fontWeight: 480 }}>{title}</p>
        {right}
      </header>
      {children}
    </motion.div>
  )
}
