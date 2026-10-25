import { useMemo, useState, type ReactNode } from 'react'
import { AlignLeft, AtSign, BarChart3, CalendarDays, Check, Copy, GalleryHorizontal, Heart, Image as ImageIcon, List, MessageCircle, Repeat2, UserPlus, Users } from 'lucide-react'
import { usePod } from '@/lib/data'
import { fmtSlot } from '@/lib/time'
import { withDefaults } from '@/lib/brand'
import type { Draft } from '@/lib/types'
import { Slide, type Marks, type Sample } from '@/components/BrandPreview'
import { CastMascot } from '@/components/cast/CastMascot'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

/* Dev-only proposal (?next): a content calendar, a Conversations tab (comments on your
   posts, people talking about you, posts worth joining) and visual posts (carousels as a
   contact sheet, image posts, a weekly format mix). Real posts and brand where they exist;
   anything made up is marked Example. Not in the deployed bundle. */

type Tab = 'calendar' | 'conversations' | 'visual'
const TABS: { key: Tab; label: string }[] = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'visual', label: 'Visual posts' },
]

export function Next() {
  const [tab, setTab] = useState<Tab>(() => ((new URLSearchParams(location.search).get('next') as Tab) || 'calendar'))
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-5 py-3">
          <CastMascot size={36} mood="happy" sleepAfter={0} quiet />
          <p className="text-[15px] text-ink" style={{ fontWeight: 520 }}>Proposal</p>
          <span className="rounded-pill bg-[#fdf3e6] px-2.5 py-0.5 text-[12px] text-[#8a4b00]">Not built yet</span>
          <nav className="ml-auto flex gap-1 rounded-pill bg-canvas p-1 ring-1 ring-line">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => { setTab(t.key); history.replaceState(null, '', `?next=${t.key}`) }} className={cn('rounded-pill px-3.5 py-1.5 text-[13.5px]', tab === t.key ? 'bg-primary text-white' : 'text-ink-2 hover:text-ink')}>{t.label}</button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
        {tab === 'calendar' ? <CalendarProposal /> : tab === 'conversations' ? <ConversationsProposal /> : <VisualProposal />}
      </main>
    </div>
  )
}

function Intro({ eyebrow, title, lede, points }: { eyebrow: string; title: string; lede: string; points: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] uppercase tracking-[0.07em] text-ink-2">{eyebrow}</p>
      <h1 className="text-[32px] leading-tight text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</h1>
      <p className="max-w-[62ch] text-[16.5px] text-ink-2">{lede}</p>
      <ul className="ml-5 grid max-w-[62ch] list-disc gap-1 text-[15px] text-ink marker:text-primary">{points.map((p) => <li key={p}>{p}</li>)}</ul>
    </div>
  )
}

const Example = () => <span className="rounded-pill bg-[#f0f0f4] px-2 py-0.5 text-[11.5px] text-slate">Example</span>
const FMT: Record<string, typeof AlignLeft> = { text: AlignLeft, carousel: GalleryHorizontal, image: ImageIcon, poll: BarChart3 }

// ── 1. calendar ───────────────────────────────────────────────────────────────

function CalendarProposal() {
  const pod = usePod()
  const p = pod.profile
  const tz = p?.timezone || undefined
  const days = (p?.posting_days || ['mon', 'wed', 'fri']).map((d) => d.slice(0, 3))
  const ready = pod.drafts.filter((d) => d.status === 'ready')
  // three weeks from this Monday
  const start = useMemo(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    const back = (now.getDay() + 6) % 7
    now.setHours(0, 0, 0, 0)
    now.setDate(now.getDate() - back)
    return now
  }, [tz])
  const cells = Array.from({ length: 21 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const key = (d: Date) => d.toLocaleDateString('en-CA')
  const localKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz })
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const onDay = (k: string) => pod.drafts.filter((d) => (d.scheduled_for && (d.status === 'approved' || d.status === 'publishing' || d.status === 'ready') && localKey(d.scheduled_for) === k) || (d.published_at && localKey(d.published_at) === k))
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const mix = pod.drafts.filter((d) => ['approved', 'published', 'ready'].includes(d.status)).reduce<Record<string, number>>((m, d) => { const f = d.format || 'text'; m[f] = (m[f] || 0) + 1; return m }, {})
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  let openShown = 0
  return (
    <>
      <Intro eyebrow="Posts · proposal 1" title="See your posts on a calendar" lede="Today Posts shows a list of what’s coming. A calendar shows the week’s shape at a glance: what goes out when, which slots are open, and the format mix." points={['Your posting days are tinted; scheduled and published posts sit on their day.', 'A planned post (ready, not yet approved) is dashed: it never goes out until you approve it.', 'An open slot appears only in the next two weeks, with one way to fill it. Drag a post to move it.']} />
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Posts</h2>
          <div className="flex gap-1 rounded-pill bg-canvas p-1 ring-1 ring-line">
            {(['calendar', 'list'] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px]', view === v ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2')}>{v === 'calendar' ? <CalendarDays className="size-3.5" /> : <List className="size-3.5" />}{v === 'calendar' ? 'Calendar' : 'List'}</button>)}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-[11.5px] text-slate">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="px-1">{d}</span>)}</div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {cells.map((d) => {
            const k = key(d)
            const posts = onDay(k)
            const slot = days.includes(DOW[d.getDay()])
            const past = k < today
            const [hh, mm] = (p?.posting_time || '08:30').split(':').map(Number)
            const at = new Date(d); at.setHours(hh, mm, 0, 0)
            const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
            const open = slot && at > nowLocal && !posts.length && openShown < 2 && (at.getTime() - nowLocal.getTime()) < 14 * 86400e3
            if (open) openShown++
            return (
              <div key={k} className={cn('flex min-h-[92px] flex-col gap-1 rounded-xl p-1.5 ring-1', slot ? 'bg-lavender/50 ring-transparent' : 'bg-canvas ring-line/60', past && 'opacity-55', k === today && 'ring-2 ring-primary')}>
                <span className={cn('px-1 text-[12px] tabular', k === today ? 'text-primary' : 'text-ink-2')} style={{ fontWeight: k === today ? 600 : 400 }}>{d.getDate()}</span>
                {posts.map((x) => <CalChip key={x.id} d={x} tz={tz} />)}
                {open ? <button type="button" className="mt-auto rounded-lg border border-dashed border-primary/40 px-1.5 py-1 text-left text-[11px] text-primary hover:bg-primary/8">Open slot{ready.length ? ` · ${ready.length} ready` : ''}</button> : null}
              </div>
            )
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-[13.5px] text-ink-2">
          <span className="text-ink" style={{ fontWeight: 500 }}>This month’s mix</span>
          {(['text', 'carousel', 'image', 'poll'] as const).map((f) => { const I = FMT[f]; return <span key={f} className="flex items-center gap-1.5"><I className="size-3.5 text-primary" />{mix[f] || 0} {f}</span> })}
          <span className="ml-auto rounded-pill bg-[#fdf3e6] px-2.5 py-1 text-[12.5px] text-[#8a4b00]">All text so far. One in three as a visual?</span>
        </div>
      </section>
    </>
  )
}

function CalChip({ d, tz }: { d: Draft; tz?: string }) {
  const I = FMT[d.format || 'text'] || AlignLeft
  const out = d.status === 'published'
  const planned = d.status === 'ready'
  return (
    <span className={cn('flex flex-col gap-0.5 rounded-lg px-1.5 py-1 text-[11px] leading-tight', out ? 'bg-[#e8f5ee] text-[#1f5c3d]' : planned ? 'border border-dashed border-primary/50 bg-transparent text-ink-2' : 'bg-surface text-ink ring-1 ring-line')}>
      <span className="flex items-center gap-1 text-[10.5px] text-slate"><I className="size-3" />{fmtSlot(d.scheduled_for || d.published_at, tz).split(' ').slice(1).join(' ')}{out ? ' · out' : planned ? ' · needs OK' : ''}</span>
      <span className="line-clamp-2">{d.title || d.body?.slice(0, 50)}</span>
    </span>
  )
}

// ── 2. conversations ──────────────────────────────────────────────────────────

function ConversationsProposal() {
  const pod = usePod()
  const p = pod.profile
  const signedIn = p?.browser_status === 'signed_in'
  const listen = [p?.company_name?.replace(/\.work$/i, ''), 'Software Factory', 'LinkedIn Growth Manager', p?.linkedin_name].filter((x): x is string => !!x)
  const next = pod.drafts.filter((d) => d.status === 'approved' && d.scheduled_for).sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())[0]
  return (
    <>
      <Intro eyebrow="Engage, rebuilt · proposal 2" title="Conversations: where you show up for people" lede="Engage today only finds other people’s posts on your topics, and it’s switched off for you. Three kinds of conversation matter, in this order, and all three belong in your 10 minutes." points={['On your posts: for two hours after a post goes out, each new comment arrives with a reply drafted. Replying to comments is the habit with the clearest payoff.', 'About you: your LinkedIn mentions, plus a saved search for Lemma and your products, newest first. Thank them, react, repost with a note, or add them to People.', 'Join in: fresh posts on your topics and from people you follow, each with a reply drafted, toward a weekly target.']} />

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <h2 className="text-[17px] text-ink" style={{ fontWeight: 520 }}>What I listen for</h2>
        <p className="mt-1 text-[14px] text-ink-2">Prefilled from your company and the products you post about. I read your Mentions and search these words, newest first, in your own browser twice a day. LinkedIn has no official way to do this for a person.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {listen.map((k) => <span key={k} className="rounded-pill bg-primary/10 px-3 py-1 text-[13px] text-ink">{k}</span>)}
          <button type="button" className="rounded-pill px-3 py-1 text-[13px] text-primary ring-1 ring-dashed ring-primary/40">+ Add a word</button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2"><span className={cn('grid size-4 place-items-center rounded-full', signedIn ? 'bg-primary text-white' : 'bg-line')}>{signedIn ? <Check className="size-3" /> : null}</span>Your LinkedIn browser is {signedIn ? 'signed in' : 'signed out'} · topics: {pod.topics.length || 'none yet, add two in Recommended'}</p>
      </section>

      <Stream icon={<MessageCircle className="size-4" />} title="On your posts" sub={next ? `For two hours after your ${fmtSlot(next.scheduled_for, p?.timezone)} post goes out.` : 'For two hours after each post.'}>
        <ConvoCard who="Ravi K." role="Head of Support, a Series B fintech" what={`commented on “${next?.title || 'The model is not the hard part'}”`} quote="The permissions point is underrated. We lost two months to it." reply="Two months sounds about right. What finally fixed it for you, a role model or per-team spaces?" actions={['Copy and open', 'Like it']} />
      </Stream>

      <Stream icon={<AtSign className="size-4" />} title="About you" sub="Mentions of you, Lemma and your products.">
        <ConvoCard who="Ananya S." role="Founder, an ops consultancy" what="mentioned Lemma" quote="Tried Lemma’s Software Factory this week. Shipping small fixes from Slack threads is a strange new superpower." reply="Thanks Ananya. Curious which fix surprised you most?" actions={['Copy and open', 'React', 'Repost with a note', 'Add to People']} />
      </Stream>

      <Stream icon={<Users className="size-4" />} title="Join in" sub="Fresh posts on your topics, five a day.">
        <ConvoCard who="Meera R." role="VP Operations, a logistics company" what="posted about AI pilots" quote="Every AI pilot we ran demoed well and died in week three. Nobody tells you why." reply="Week three is when the context runs out. The demo had a curated week; the job has a messy month." actions={['Copy and open', 'Skip']} />
      </Stream>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <div className="flex items-baseline justify-between gap-3"><p className="text-[15px] text-ink" style={{ fontWeight: 520 }}>This week</p><span className="text-[13px] tabular text-ink-2">3 of 15 conversations</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-lavender"><div className="h-full w-[20%] rounded-full bg-primary" /></div>
        <p className="mt-2 text-[13px] text-ink-2">Replies on your posts, mentions you answered, and posts you joined all count. A weekly target, not a daily streak.</p>
      </section>
      <p className="text-[13px] text-slate">In your 10 minutes, replies on your own posts come first (they’re time-sensitive), then mentions, then joining in. You post every comment yourself: LinkedIn doesn’t allow comments posted by tools, so the app drafts and you click Comment. “Post it for me” would go away.</p>
    </>
  )
}

function Stream({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span><h2 className="text-[19px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{title}</h2><span className="text-[13px] text-ink-2">{sub}</span></div>
      {children}
    </section>
  )
}

function ConvoCard({ who, role, what, quote, reply, actions }: { who: string; role: string; what: string; quote: string; reply: string; actions: string[] }) {
  const icon = (a: string) => (a.startsWith('Copy') ? <Copy className="size-3.5" /> : a.startsWith('Like') || a.startsWith('Thank') ? <Heart className="size-3.5" /> : a.startsWith('Repost') ? <Repeat2 className="size-3.5" /> : a.startsWith('Add') ? <UserPlus className="size-3.5" /> : null)
  return (
    <article className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] text-ink"><span style={{ fontWeight: 500 }}>{who}</span> <span className="text-slate">· {role}</span> <span className="text-ink-2">{what}</span></p>
        <Example />
      </div>
      <p className="mt-2 border-l-2 border-lavender pl-3 text-[14.5px] text-ink-2">{quote}</p>
      <p className="mt-3 text-[12px] uppercase tracking-[0.06em] text-ink-2">Your reply</p>
      <p className="mt-1 rounded-xl bg-lavender/60 p-3 text-[15px] text-ink">{reply}</p>
      <div className="mt-3 flex flex-wrap gap-2">{actions.map((a, i) => <Button key={a} size="sm" variant={i === 0 ? 'primary' : 'tint'}>{icon(a)}{a}</Button>)}</div>
    </article>
  )
}

// ── 3. visual posts ───────────────────────────────────────────────────────────

const STYLES = [
  { key: 'twist', label: 'The twist', line: 'One surprising truth, then why' },
  { key: 'tour', label: 'Product tour', line: 'What using it is like, screen by screen' },
  { key: 'myth', label: 'Mythbuster', line: 'A belief people hold, corrected' },
  { key: 'loop', label: 'The loop', line: 'One real story with an outcome' },
  { key: 'steal', label: 'Steal this', line: 'A playbook to copy' },
]

function VisualProposal() {
  const pod = usePod()
  const p = pod.profile
  const kit = withDefaults(p?.brand, p)
  const marks: Marks = { photo: p?.photo_url || null, logo: null, logoDark: null, wordmark: null, wordmarkDark: null }
  const src = pod.drafts.find((d) => /model is not the hard part/i.test(d.title || '')) || pod.drafts.find((d) => (d.body || '').includes('→'))
  const lines = (src?.body || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const parts = lines.filter((l) => l.startsWith('→')).map((l) => l.replace(/^→\s*/, '')).slice(0, 4)
  const points = parts.length >= 3 ? parts : ['Context that has to survive a week, not a session', 'A review loop, so a human still signs off', 'Integrations into the tools the work already lives in', 'Permissions, so each person sees what they should']
  const cover = (lines[0] || 'Everyone’s AI demo works. Almost nobody’s deployment does.').slice(0, 70)
  const [style, setStyle] = useState('twist')
  const s = (point: string, body: string): Sample => ({ kicker: 'Deploying AI', cover, point, body })
  const slides: { kind: 'cover' | 'point' | 'cta'; sample: Sample }[] = [
    { kind: 'cover', sample: s('', '') },
    { kind: 'point', sample: s('The model is not the hard part.', 'Everything around it is, and it shows up in week three.') },
    ...points.map((pt, i) => {
      // a slide headline is the claim; anything after a dash, colon or comma is the line under it
      const [head, ...rest] = pt.split(/\s[—–-]\s|:\s|,\s/)
      const body = rest.join(', ').trim()
      return { kind: 'point' as const, sample: s(`${i + 1}. ${head.trim()}`, body ? body.charAt(0).toUpperCase() + body.slice(1).replace(/\.?$/, '.') : 'This is where pilots stall, quietly.') }
    }),
    { kind: 'cta', sample: s('', '') },
  ]
  return (
    <>
      <Intro eyebrow="Content · proposal 3" title="Posts that aren’t all text" lede="Every draft so far has been text. The craft for carousels and image posts is already in the pod. Spool just never chooses it, and you can’t see a carousel before it’s rendered." points={['A weekly mix: one visual in every three posts to start, then tuned to what works for you, from your own results.', 'Carousels arrive as a contact sheet you can read at a glance, in your brand kit, with a style you can switch.', 'Image posts (a strong line or a number, as a card) go out through your LinkedIn connection. Carousels go out from your browser as a PDF.']} />

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[19px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>This week’s plan</h2>
          <span className="text-[13px] text-ink-2">3 posts · 1 visual</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[{ day: 'Mon', f: 'text', t: 'A chatbot learns you, a teammate learns your team' }, { day: 'Wed', f: 'carousel', t: 'The model is not the hard part, as 6 slides' }, { day: 'Fri', f: 'image', t: '“Everyone’s AI demo works.” as a card' }].map((x) => {
            const I = FMT[x.f]
            return <div key={x.day} className={cn('rounded-xl p-3 ring-1', x.f === 'text' ? 'bg-canvas ring-line' : 'bg-lavender ring-transparent')}><p className="flex items-center gap-1.5 text-[12px] text-ink-2"><I className="size-3.5 text-primary" />{x.day} · {x.f}</p><p className="mt-1 text-[14px] leading-snug text-ink">{x.t}</p></div>
          })}
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">A carousel to approve · from your post “{src?.title || 'The model is not the hard part'}”</p>
            <h2 className="mt-1 text-[22px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>The whole carousel, at a glance</h2>
          </div>
          <span className="text-[12.5px] text-ink-2">Your brand kit · {kit.fonts?.heading} · {kit.style} slides</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STYLES.map((x) => <button key={x.key} type="button" onClick={() => setStyle(x.key)} title={x.line} className={cn('rounded-pill px-3 py-1.5 text-[12.5px] ring-1', style === x.key ? 'bg-primary text-white ring-primary' : 'bg-canvas text-ink ring-line hover:bg-lavender')}>{x.label}</button>)}
        </div>
        <p className="mt-2 text-[13px] text-ink-2">{STYLES.find((x) => x.key === style)?.line}. Picked because the post is one claim with four parts.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#e9e8f3] p-3 sm:grid-cols-4">
          {slides.map((sl, i) => (
            <div key={i}>
              <Slide kit={kit} kind={sl.kind} style={(kit.style || 'dark') as 'dark'} marks={marks} sample={sl.sample} />
              <p className="mt-1 text-center text-[11px] text-slate">{i + 1}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary">Approve for Wed 12:00</Button>
          <Button>Work on it</Button>
          <Button variant="ghost">Keep it as text</Button>
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2"><span><Check className="mr-1 inline size-3.5 text-primary" />Text fits on every slide</span><span><Check className="mr-1 inline size-3.5 text-primary" />Readable at phone size</span><span><Check className="mr-1 inline size-3.5 text-primary" />{slides.length} slides, one idea each</span><button type="button" className="text-primary hover:underline">Swipe through it as LinkedIn shows it</button></p>
        <p className="mt-2 text-[12.5px] text-slate">On approval I render the PDF and post it from your browser. Each slide is 1080×1350; the sheet is for reading, not posting.</p>
      </section>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">An image post</p>
        <div className="mt-3 grid items-start gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
          <Slide kit={kit} kind="cover" style="brand" marks={marks} sample={{ kicker: 'Field notes', cover: 'Everyone’s AI demo works. Almost nobody’s deployment does.', point: '', body: '' }} />
          <div className="flex flex-col gap-3">
            <p className="text-[15px] text-ink">The first line of your post, as a card in your brand colour. The caption carries the rest.</p>
            <p className="text-[13.5px] text-ink-2">Goes out through your LinkedIn connection like a text post. You can swap the card for a photo of your own.</p>
            <div className="flex flex-wrap gap-2"><Button variant="primary" size="sm">Approve</Button><Button size="sm">Use my own photo</Button></div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-lavender/60 p-5 sm:p-6">
        <h2 className="text-[17px] text-ink" style={{ fontWeight: 520 }}>From Content Factory</h2>
        <p className="mt-1 max-w-[62ch] text-[14px] text-ink-2">Your product kits (Software Factory, and LinkedIn Growth Manager once its kit is made) already hold approved carousels and posts. They could arrive here as drafts, rewritten in your voice, for your slots. That needs a small bridge between the two pods.</p>
      </section>
    </>
  )
}
