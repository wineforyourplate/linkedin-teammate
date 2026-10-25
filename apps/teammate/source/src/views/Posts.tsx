import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { usePod } from '@/lib/data'
import { talkThrough } from '@/lib/ideas'
import { useChat, useChatContext } from '@/lib/chat'
import { fmtSlot } from '@/lib/time'
import type { Draft } from '@/lib/types'
import { Button, Card, Chip, Eyebrow } from '@/components/ui'
import { PageHead } from '@/components/Shell'
import { PostPreview, useApprove } from './Today'
import { Topics } from '@/components/Topics'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'ready', label: 'Ready', match: (d: Draft) => d.status === 'ready' || d.status === 'drafting' },
  { key: 'ideas', label: 'Ideas', match: (d: Draft) => d.status === 'idea' },
  { key: 'scheduled', label: 'Scheduled', match: (d: Draft) => d.status === 'approved' || d.status === 'publishing' || d.status === 'failed' },
  { key: 'published', label: 'Published', match: (d: Draft) => d.status === 'published' },
] as const

const FORMATS = [
  { key: 'text', label: 'Text' },
  { key: 'image', label: 'Image or quote card' },
  { key: 'carousel', label: 'Swipeable carousel (PDF)' },
  { key: 'poll', label: 'Poll' },
  { key: 'link', label: 'Link with your take' },
] as const

export function Posts() {
  const pod = usePod()
  const chat = useChat()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('ready')
  const [editing, setEditing] = useState<string | null>(null)
  useChatContext(editing ? `Posts · editing draft ${editing}` : `Posts · ${tab}`)
  const { profile, drafts } = pod
  const tz = profile?.timezone
  const list = drafts.filter(TABS.find((t) => t.key === tab)!.match)
  const [note, setNote] = useState('')
  const [format, setFormat] = useState<string>('text')
  const signedIn = profile?.browser_status === 'signed_in'

  const week = useMemo(() => {
    const days: { label: string; posts: Draft[] }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() + i * 86400000)
      const key = d.toLocaleDateString(undefined, { timeZone: tz || undefined })
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', timeZone: tz || undefined }),
        posts: drafts.filter((x) => (x.status === 'approved' || x.status === 'published') && (x.scheduled_for || x.published_at) && new Date((x.scheduled_for || x.published_at) as string).toLocaleDateString(undefined, { timeZone: tz || undefined }) === key),
      })
    }
    return days
  }, [drafts, tz])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead title="Posts" sub={`${profile?.posts_per_week || 2} a week, around ${profile?.posting_time || '08:30'}`} />

      <section className="mb-8">
        <h2 className="mb-1 text-[18px] text-ink" style={{ fontWeight: 470 }}>Your topics</h2>
        <Topics intro="I research each one for what people are saying this month, suggest posts from it, and find conversations on it in Engage." />
      </section>

      <div className="mb-6 grid grid-cols-7 gap-2">
        {week.map((d) => (
          <div key={d.label} className={cn('min-h-20 rounded-sm p-2', d.posts.length ? 'bg-lavender' : 'ring-1 ring-line')}>
            <p className="text-[11px] text-slate tabular">{d.label}</p>
            {d.posts.map((p) => <p key={p.id} className="mt-1 line-clamp-2 text-[11px] text-ink">{p.title || p.body?.slice(0, 40)}</p>)}
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <Eyebrow>New post</Eyebrow>
        <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; void chat.send(`Draft a ${format} post for me about: ${note.trim()}. Use my voice and leave it ready.`); setNote('') }}>
          <label htmlFor="newpost" className="sr-only">What do you want to post about?</label>
          <textarea id="newpost" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What do you want to post about? A thought, a lesson, a number…" className="rounded-md bg-canvas p-3 text-[15px] text-ink ring-1 ring-line placeholder:text-slate focus:outline-none focus:ring-primary" />
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => <Chip key={f.key} selected={format === f.key} onClick={() => setFormat(f.key)}>{f.label}</Chip>)}
          </div>
          {format === 'carousel' && !signedIn ? <p className="text-[13px] text-ink-2">Swipeable PDF carousels can only be posted from your signed-in browser, or uploaded by you. I’ll make the PDF either way.</p> : null}
          <Button variant="primary" type="submit" className="w-fit" disabled={!note.trim()}>Draft it</Button>
        </form>
      </Card>

      <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
        {TABS.map((t) => {
          const n = drafts.filter(t.match).length
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn('-mb-px border-b-2 px-4 py-3 text-[14px]', tab === t.key ? 'border-primary text-ink' : 'border-transparent text-ink-2 hover:text-ink')} style={{ fontWeight: tab === t.key ? 480 : 400 }}>
              {t.label} {n ? <span className="text-slate tabular">{n}</span> : null}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-4">
        {!list.length ? (
          <Card className="text-center">
            <p className="text-[15px] text-ink-2">
              {tab === 'ready' ? 'No drafts waiting. Pick an idea or tell me what to post about.' : tab === 'ideas' ? 'Ideas arrive every morning when Post for me is on.' : tab === 'scheduled' ? 'Nothing scheduled. Approve a draft and it takes your next slot.' : 'Nothing published yet.'}
            </p>
          </Card>
        ) : (
          list.map((d) => <DraftCard key={d.id} d={d} editing={editing === d.id} setEditing={(v) => setEditing(v ? d.id : null)} tz={tz} />)
        )}
      </div>
    </div>
  )
}

export function DraftCard({ d, editing, setEditing, tz }: { d: Draft; editing: boolean; setEditing: (v: boolean) => void; tz?: string | null }) {
  const pod = usePod()
  const chat = useChat()
  const approve = useApprove()
  const [body, setBody] = useState(d.body || '')
  const name = pod.profile?.linkedin_name || pod.profile?.display_name || 'You'

  if (d.status === 'idea') {
    return (
      <Card>
        <p className="text-[16px] text-ink" style={{ fontWeight: 460 }}>{d.title}</p>
        {d.why_now ? <p className="mt-1 text-[14px] text-ink-2">{d.why_now}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={() => void talkThrough(chat.send, d)}>Talk it through</Button>
          <Button onClick={() => void chat.send(`Draft idea ${d.id} now in my voice and leave it ready.`, { silent: true })}>Just draft it</Button>
          <Button variant="ghost" onClick={() => void pod.update('drafts', d.id, { status: 'killed' })}>Not this</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-slate">{d.format} · {d.status === 'published' ? `published ${fmtSlot(d.published_at, tz)}${d.via ? ` via ${d.via}` : ''}` : d.status === 'approved' ? `goes out ${fmtSlot(d.scheduled_for, tz)}` : d.status === 'failed' ? 'didn’t go out' : d.status === 'drafting' ? 'writing…' : 'ready for you'}</span>
        {d.post_url ? <a href={d.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-primary">Open on LinkedIn <ExternalLink className="size-3.5" /></a> : null}
      </div>
      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <label htmlFor={`b-${d.id}`} className="text-[13px] text-ink-2">Your edits teach me your voice.</label>
          <textarea id={`b-${d.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="rounded-md bg-canvas p-4 text-[15px] leading-relaxed text-ink ring-1 ring-line focus:outline-none focus:ring-primary" />
          <p className="text-[12px] text-slate tabular">{body.length} / 3000</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={async () => { await pod.update('drafts', d.id, { body, status: d.status === 'approved' ? 'ready' : d.status }); setEditing(false) }}>Save</Button>
            <Button variant="ghost" onClick={() => { setBody(d.body || ''); setEditing(false) }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <PostPreview d={d} name={name} headline={pod.profile?.headline} />
      )}
      {d.error ? <p className="mt-3 rounded-md bg-alert-soft p-3 text-[13px] text-alert">{d.error}</p> : null}
      {d.status === 'published' ? (
        <p className="mt-3 text-[14px] text-ink-2 tabular">{d.reactions != null ? `${d.reactions} reactions · ${d.comments ?? 0} comments` : 'Numbers arrive with the weekly 1:1.'}</p>
      ) : !editing ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {d.status === 'ready' ? <Button variant="primary" onClick={() => void approve(d)}>Approve</Button> : null}
          {d.status === 'approved' ? <Button onClick={() => void pod.update('drafts', d.id, { status: 'ready' })}>Unschedule</Button> : null}
          <Button onClick={() => setEditing(true)}>Edit</Button>
          {['Sharper hook', 'Shorter', 'More like me'].map((c) => (
            <Button key={c} variant="ghost" size="sm" onClick={() => void chat.send(`Rewrite draft ${d.id}: ${c.toLowerCase()}.`, { silent: true })}>{c}</Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => void pod.update('drafts', d.id, { status: 'killed' })}>Kill</Button>
        </div>
      ) : null}
    </Card>
  )
}
