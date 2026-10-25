import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat, useChatContext } from '@/lib/chat'
import { ago } from '@/lib/time'
import type { Activity, EngageRun, Engagement, Skill } from '@/lib/types'
import { Button, Card, Eyebrow, Switch } from '@/components/ui'
import { PageHead } from '@/components/Shell'
import { SignInInline, useBrowserSignIn } from '@/components/SignIn'
import { suggested, watching } from '@/lib/world'

/* Conversations worth joining, as two jobs on the person's own clock, both off until they
   switch them on:
   - Replies (cheap, every few hours): read back their comments, then draft replies to people
     who commented on their posts or answered their comments.
   - Finding (the expensive browse, up to 3 runs a day): fresh posts from the people in their world.
   They approve in one go and the teammate posts one by one (the engage-run workflow), or, in
   "copy" mode, they post each one themselves. Limits and the scorecard live here; their world
   lives in Personalization. */

const OPEN = new Set(['proposed', 'liked', 'approved', 'posting', 'failed'])
export const DEFAULT_RUNS: EngageRun[] = [
  { key: 'r1', label: 'Morning', time: '09:30', size: 10, on: false },
  { key: 'r2', label: 'Afternoon', time: '14:00', size: 5, on: false },
  { key: 'r3', label: 'Evening', time: '19:00', size: 5, on: false },
]
const CEILING = { comments: 20, likes: 30, pages: 120 }
type Mode = 'approve' | 'copy'
type Replies = { on?: boolean; every_hours?: number; last_run_at?: string | null }
type Settings = { runs?: EngageRun[]; mode?: Mode; replies?: Replies; [k: string]: unknown }

const settingsOf = (s?: Skill | null) => (s?.settings || {}) as Settings
export function runsOf(s?: Skill | null): EngageRun[] {
  const saved = settingsOf(s).runs || []
  return DEFAULT_RUNS.map((d) => ({ ...d, ...(saved.find((r) => r.key === d.key) || {}) }))
}
export const modeOf = (s?: Skill | null): Mode => (settingsOf(s).mode === 'copy' ? 'copy' : 'approve')
const engaged = (e: Engagement) => (e.outcome?.likes || 0) > 0 || (e.outcome?.replies || 0) > 0
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '')
const MODEL: Record<string, string> = { claude: 'Claude', teammate: 'DeepSeek' }
const modelName = (m?: string | null) => (m ? MODEL[m] || (/deepseek/i.test(m) ? 'DeepSeek' : m) : null)

function useSaveSettings(skill: Skill) {
  const pod = usePod()
  return (patch: Partial<Settings>) => void pod.update('skills', skill.id, { settings: { ...settingsOf(skill), ...patch } })
}

/** A person's face, or their initials when there's no photo (or it has expired). */
export function Avatar({ name, photo, size = 36, tint: color }: { name?: string | null; photo?: string | null; size?: number; tint?: string }) {
  const [broken, setBroken] = useState(false)
  const initials = (name || '?').split(/\s+/).map((w) => w[0]).join('').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()
  const tint = color || ['#e9e3ff', '#dcebff', '#fff1c2', '#daf3e5', '#ffe2d3'][(name || '').length % 5]
  return photo && !broken ? (
    <img src={photo} alt="" width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover ring-2 ring-surface" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-full text-ink ring-2 ring-surface" style={{ width: size, height: size, background: tint, fontSize: size * 0.34, fontWeight: 600 }}>{initials}</span>
  )
}

export function Engage() {
  useChatContext('Engage')
  const pod = usePod()
  const chat = useChat()
  const { engagements, skills, profile } = pod
  const skill = skills.find((s) => s.key === 'engage')
  const on = skill?.state === 'on' || skill?.state === 'needs_you'
  const signedIn = profile?.browser_status === 'signed_in'
  const mode = modeOf(skill)
  const [finding, setFinding] = useState(false)
  const open = engagements
    .filter((e) => OPEN.has(e.status) && e.comment_draft)
    .sort((a, b) => Number(b.method === 'own_post' || b.method === 'thread') - Number(a.method === 'own_post' || a.method === 'thread') || new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  const waiting = open.filter((e) => e.status === 'proposed' || e.status === 'liked')
  const directed = waiting.filter((e) => e.method === 'own_post' || e.method === 'thread').length
  const busy = finding || engagements.some((e) => e.status === 'approved' || e.status === 'posting')
  useWaitFor(busy, ['engagements', 'activity'], 5000, 15 * 60 * 1000)

  const find = () => {
    setFinding(true)
    void chat.task('[engage] find')
    window.setTimeout(() => setFinding(false), 6 * 60 * 1000)
  }
  const approveAll = () => {
    for (const e of waiting) void pod.update('engagements', e.id, { status: 'approved', error: null })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead
        title="Engage"
        sub="Answer the people talking to you, and join the right threads, on your schedule."
        right={on && signedIn ? <Button variant="tint" busy={finding} onClick={find}>{finding ? 'Looking…' : 'Find posts now'}</Button> : null}
      />

      {!on ? (
        <Card tint className="mb-6">
          <p className="text-[16px] text-ink">Switch on Join conversations, then pick when I should look.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => skill && void pod.update('skills', skill.id, { state: 'on', started_at: skill.started_at || new Date().toISOString() })}>Switch it on</Button>
            {!signedIn ? <span className="text-[13px] text-ink-2">It reads LinkedIn in your own browser, so it needs your sign-in once.</span> : null}
          </div>
        </Card>
      ) : !signedIn ? (
        <Card tint className="mb-6">
          <p className="text-[16px] text-ink">I read LinkedIn in your own browser. Sign in once and I’ll bring posts here.</p>
          <div className="mt-4"><SignInInline /></div>
        </Card>
      ) : null}

      {waiting.length ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Ready for you</Eyebrow>
            <p className="mt-1 text-[14px] text-ink-2">{waiting.length} to go{directed ? `, ${directed} of them replies to people talking to you` : ''}. Edit any, skip any.</p>
          </div>
          {mode === 'approve' ? <Button variant="primary" onClick={approveAll}><Check className="size-4" /> Approve all {waiting.length}</Button> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {open.map((e) => <ReplyCard key={e.id} e={e} />)}
        {!open.length && on && signedIn ? (
          <Card className="text-center">
            <p className="text-[16px] text-ink">{finding ? 'Looking for fresh posts…' : 'Nothing waiting right now.'}</p>
            <p className="mt-2 text-[14px] text-ink-2">{skill && (settingsOf(skill).replies?.on || runsOf(skill).some((r) => r.on)) ? 'New ones arrive with your next replies check or finding run.' : 'Switch on replies or a finding run below and they’ll arrive on their own.'}</p>
          </Card>
        ) : null}
      </div>

      <div className="mt-10"><Scorecard rows={engagements} /></div>

      {on && skill ? (
        <section className="mt-10 flex flex-col gap-4" aria-label="Settings">
          <Eyebrow>How it runs</Eyebrow>
          <RepliesCard skill={skill} hours={profile?.working_hours} />
          <Runs skill={skill} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Limits skill={skill} activity={pod.activity} />
            <ModeCard skill={skill} />
          </div>
          <WorldCard />
        </section>
      ) : null}
    </div>
  )
}

/** Replies: the cheap, directed job. Every few hours inside working hours. */
function RepliesCard({ skill, hours }: { skill: Skill; hours?: string | null }) {
  const save = useSaveSettings(skill)
  const r: Replies = { on: false, every_hours: 2, ...(settingsOf(skill).replies || {}) }
  const set = (patch: Replies) => save({ replies: { ...r, ...patch } })
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[16px] text-ink" style={{ fontWeight: 520 }}>Replies</p>
          <p className="mt-1 text-[14px] text-ink-2">People commenting on your posts and answering your comments. Quick to check, so I look often.</p>
        </div>
        <Switch checked={!!r.on} onChange={(v) => set({ on: v })} label="Replies" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
        <span>Every</span>
        <label className="sr-only" htmlFor="rep-every">How often</label>
        <select id="rep-every" value={r.every_hours} onChange={(e) => set({ every_hours: Number(e.target.value) })} className="h-9 rounded-pill bg-canvas px-3 text-[14px] text-ink ring-1 ring-line">
          {[1, 2, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'hour' : 'hours'}</option>)}
        </select>
        <span>during your working hours{hours ? ` (${hours.replace('-', '–')})` : ''}.</span>
        {r.on && r.last_run_at ? <span className="ml-auto text-[12.5px] text-slate">last {ago(r.last_run_at)}</span> : null}
      </div>
    </Card>
  )
}

/** Finding new posts: up to three runs, each with its own time and batch size, all off until
    switched on. This is the expensive job: the browser runs for most of it. */
function Runs({ skill }: { skill: Skill }) {
  const save = useSaveSettings(skill)
  const runs = runsOf(skill)
  const setRun = (key: string, patch: Partial<EngageRun>) => save({ runs: runs.map((r) => (r.key === key ? { ...r, ...patch } : r)) })
  const live = runs.filter((r) => r.on)
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[16px] text-ink" style={{ fontWeight: 520 }}>Finding new posts</p>
        <span className="text-[12.5px] text-slate">{live.length ? `${live.length} of 3 on` : 'All off'}</span>
      </div>
      <p className="mt-1 text-[14px] text-ink-2">I read the people in your world for posts published since the last run, and bring a batch of comments to approve. This one takes a while, so pick your times.</p>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {runs.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-3 py-3">
            <span className="w-24 text-[15px] text-ink" style={{ fontWeight: 480 }}>{r.label}</span>
            <label className="sr-only" htmlFor={`t-${r.key}`}>{r.label} time</label>
            <input id={`t-${r.key}`} type="time" value={r.time} onChange={(e) => setRun(r.key, { time: e.target.value })} className="h-10 rounded-pill bg-canvas px-4 text-[15px] text-ink ring-1 ring-line" />
            <label className="sr-only" htmlFor={`s-${r.key}`}>{r.label} batch size</label>
            <select id={`s-${r.key}`} value={r.size} onChange={(e) => setRun(r.key, { size: Number(e.target.value) })} className="h-10 rounded-pill bg-canvas px-4 text-[15px] text-ink ring-1 ring-line">
              {[5, 10, 15].map((n) => <option key={n} value={n}>{n} posts</option>)}
            </select>
            <span className="ml-auto flex items-center gap-3">
              {r.on && r.last_run_at ? <span className="text-[12.5px] text-slate">last {ago(r.last_run_at)}</span> : null}
              <Switch checked={r.on} onChange={(v) => setRun(r.key, { on: v })} label={`${r.label} run`} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Daily limits, editable under fixed ceilings, with what today has used so far. */
function Limits({ skill, activity }: { skill: Skill; activity: Activity[] }) {
  const pod = usePod()
  const caps = (skill.caps || {}) as { comments?: number; likes?: number }
  const comments = Math.min(caps.comments ?? 15, CEILING.comments)
  const likes = Math.min(caps.likes ?? 30, CEILING.likes)
  const today = new Date().toDateString()
  const todays = activity.filter((a) => a.created_at && new Date(a.created_at).toDateString() === today)
  const used = {
    comments: todays.filter((a) => a.action === 'comment').length,
    likes: todays.filter((a) => a.action === 'like').length,
    pages: todays.reduce((n, a) => n + (a.page_loads || 0), 0),
  }
  const set = (patch: { comments?: number; likes?: number }) => void pod.update('skills', skill.id, { caps: { ...caps, comments, likes, ...patch } })
  const row = (label: string, value: number, options: number[], key: 'comments' | 'likes', usedN: number) => (
    <li className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={`cap-${key}`} className="text-[14px] text-ink">{label}</label>
      <span className="flex items-center gap-3">
        <span className="text-[12.5px] text-slate tabular">{usedN} today</span>
        <select id={`cap-${key}`} value={value} onChange={(e) => set({ [key]: Number(e.target.value) })} className="h-9 rounded-pill bg-canvas px-3 text-[14px] text-ink ring-1 ring-line">
          {options.map((n) => <option key={n} value={n}>{n} a day</option>)}
        </select>
      </span>
    </li>
  )
  return (
    <Card>
      <p className="text-[16px] text-ink" style={{ fontWeight: 520 }}>Daily limits</p>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {row('Comments', comments, [5, 10, 15, 20], 'comments', used.comments)}
        {row('Likes', likes, [10, 15, 20, 30], 'likes', used.likes)}
      </ul>
      <p className="mt-2 text-[12.5px] text-slate">Pages opened today: {used.pages} of {CEILING.pages}, shared by everything I do on LinkedIn. I stop at the first warning.</p>
    </Card>
  )
}

/** How comments go out: approve a batch and I post it, or post them yourself. */
function ModeCard({ skill }: { skill: Skill }) {
  const save = useSaveSettings(skill)
  const mode = modeOf(skill)
  return (
    <Card>
      <p className="text-[16px] text-ink" style={{ fontWeight: 520 }}>How comments go out</p>
      <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="How comments go out">
        {([['approve', 'I approve a batch, you post it', 'One at a time, a few minutes apart.'], ['copy', 'I post them myself', 'Copy, open the post, paste.']] as const).map(([k, l, d]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => save({ mode: k })} className={`rounded-xl px-4 py-2.5 text-left ring-1 ${mode === k ? 'bg-ink text-white ring-ink' : 'bg-surface text-ink ring-line hover:ring-ink/30'}`}>
            <span className="block text-[14px]" style={{ fontWeight: 520 }}>{l}</span>
            <span className={`block text-[12.5px] ${mode === k ? 'text-white/70' : 'text-slate'}`}>{d}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}

/** Your world lives in Personalization; here it's a glance and a way there. */
function WorldCard() {
  const pod = usePod()
  const list = watching(pod.world)
  const toAdd = suggested(pod.world).length
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] text-ink" style={{ fontWeight: 520 }}>Your world</p>
          <p className="mt-1 text-[13.5px] text-ink-2">{list.length ? `${list.length} ${list.length === 1 ? 'person' : 'people'} I read for fresh posts${toAdd ? ` · ${toAdd} suggested` : ''}` : 'The people whose posts I read. I map it from your topics and the people you never miss.'}</p>
        </div>
        <a href="#/personal/world" className={`inline-flex h-9 shrink-0 items-center rounded-pill px-4 text-[14px] ${toAdd ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-primary/10 text-ink hover:bg-primary/15'}`}>{toAdd ? `Review ${toAdd}` : list.length ? 'Open' : 'Map it'}</a>
      </div>
      {list.length ? (
        <div className="mt-3 flex -space-x-2 overflow-hidden" aria-hidden="true">
          {list.slice(0, 14).map((p) => <Avatar key={p.id} name={p.name} photo={p.photo} size={34} />)}
        </div>
      ) : null}
    </Card>
  )
}

/** The last 7 days of comments: how many got a like or a reply, and what is working, by
    how the post was found, the author's size and who drafted it. */
function Scorecard({ rows }: { rows: Engagement[] }) {
  const week = useMemo(() => rows.filter((e) => e.status === 'commented' && e.done_at && Date.now() - new Date(e.done_at).getTime() < 7 * 86400e3), [rows])
  if (!week.length) return null
  const read = week.filter((e) => e.outcome)
  const hit = week.filter(engaged)
  const replies = week.reduce((a, e) => a + (e.outcome?.replies || 0), 0)
  const authors = week.filter((e) => e.outcome?.author_replied).length
  const size = (n?: number | null) => (n == null ? 'unknown' : n < 1e4 ? 'under 10K' : n < 1e5 ? '10K–100K' : n < 1e6 ? '100K–1M' : '1M+')
  const groups = (key: (e: Engagement) => string) => {
    const m = new Map<string, { n: number; hit: number }>()
    for (const e of read) { const k = key(e); const g = m.get(k) || { n: 0, hit: 0 }; g.n++; if (engaged(e)) g.hit++; m.set(k, g) }
    return Array.from(m.entries()).sort((a, b) => b[1].hit / b[1].n - a[1].hit / a[1].n || b[1].n - a[1].n)
  }
  const blocks: [string, [string, { n: number; hit: number }][]][] = [
    ['How I found the post', groups((e) => (e.method || 'other').replace(/_/g, ' '))],
    ['Author size', groups((e) => size(e.author_followers))],
  ]
  const models = groups((e) => modelName(e.drafted_by) || 'unknown')
  if (models.length > 1) blocks.push(['Drafted by', models])
  return (
    <section aria-labelledby="sc">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow><span id="sc">Your comments, last 7 days</span></Eyebrow>
        <span className="text-[12.5px] text-slate">{read.length < week.length ? `Read back ${read.length} of ${week.length} so far` : 'All read back'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(week.length), 'comments'],
          [`${hit.length}`, `got a like or reply${read.length ? ` (${pct(hit.length, read.length)})` : ''}`],
          [String(replies), 'replies'],
          [String(authors), 'author replies'],
        ].map(([n, l]) => (
          <div key={l} className="rounded-xl bg-surface p-4 ring-1 ring-line">
            <p className="text-[28px] leading-none text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{n}</p>
            <p className="mt-1.5 text-[13px] text-ink-2">{l}</p>
          </div>
        ))}
      </div>
      {read.length >= 3 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {blocks.map(([title, g]) => (
            <div key={title} className="rounded-xl bg-surface p-4 ring-1 ring-line">
              <p className="text-[12px] uppercase tracking-[0.06em] text-ink-2">{title}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {g.slice(0, 5).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-3 text-[13.5px]">
                    <span className="w-28 shrink-0 truncate text-ink">{k}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-pill bg-lavender"><span className="block h-full rounded-pill bg-primary" style={{ width: `${(v.hit / v.n) * 100}%` }} /></span>
                    <span className="w-14 shrink-0 text-right tabular text-ink-2">{v.hit}/{v.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/** One comment to approve. In "approve" mode the main action approves it and the teammate
    posts it in the next few minutes; copying and posting it yourself is always there too.
    In "copy" mode they post it themselves. */
export function ReplyCard({ e, onDone, flat = false }: { e: Engagement; onDone?: () => void; flat?: boolean }) {
  const pod = usePod()
  const signIn = useBrowserSignIn()
  const mode = modeOf(pod.skills.find((s) => s.key === 'engage'))
  const [text, setText] = useState(e.comment_draft || '')
  const [copied, setCopied] = useState(false)
  const save = () => text !== e.comment_draft && void pod.update('engagements', e.id, { comment_draft: text })
  const approve = () => {
    if (!signIn.signedIn) return signIn.start()
    void pod.update('engagements', e.id, { comment_draft: text, status: 'approved', error: null })
    onDone?.()
  }
  const posted = () => { void pod.update('engagements', e.id, { status: 'commented', comment_draft: text, posted_via: 'by_hand', done_at: new Date().toISOString() }); onDone?.() }
  const skip = () => { void pod.update('engagements', e.id, { status: 'skipped', done_at: new Date().toISOString() }); onDone?.() }
  const working = e.status === 'approved' || e.status === 'posting'
  const directed = e.method === 'thread' || e.method === 'own_post'
  const model = modelName(e.drafted_by)
  const body = (
    <>
      <div className="flex items-start gap-3">
        <Avatar name={e.author_name} photo={e.author_photo} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <p className="min-w-0 text-[14px] text-ink" style={{ fontWeight: 460 }}>
              {e.author_url ? <a href={e.author_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.author_name}</a> : e.author_name}
              {directed ? <span className="ml-2 rounded-pill bg-[#e8f5ee] px-2 py-0.5 text-[12px] text-[#1f7a4d]" style={{ fontWeight: 400 }}>{e.method === 'own_post' ? 'On your post' : 'Replied to you'}</span> : null}
            </p>
            <span className="flex items-center gap-2 text-[12.5px] text-slate">
              {e.story ? <span className="rounded-pill bg-primary/8 px-2 py-0.5 text-ink-2">{e.story}</span> : null}
              {model ? <span className="rounded-pill bg-canvas px-2 py-0.5 text-ink-2 ring-1 ring-line" title="Who drafted this">{model}</span> : null}
              {e.posted_at ? ago(e.posted_at) : null}
            </span>
          </div>
          {e.author_headline ? <p className="truncate text-[12.5px] text-slate">{e.author_headline}</p> : null}
        </div>
      </div>
      {e.excerpt ? <p className="mt-3 line-clamp-4 text-[14.5px] leading-relaxed text-ink-2">{e.excerpt}</p> : null}
      {e.reason ? <p className="mt-3 border-l-2 border-lavender pl-3 text-[13.5px] text-ink-2"><span className="text-ink" style={{ fontWeight: 470 }}>{directed ? 'They said: ' : 'Why this one: '}</span>{e.reason}</p> : null}
      <label htmlFor={`r-${e.id}`} className="mt-4 block text-[12px] uppercase tracking-[0.06em] text-ink-2">{directed ? 'Your reply' : 'Your comment'}</label>
      <textarea
        id={`r-${e.id}`}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        onBlur={save}
        disabled={working}
        rows={Math.min(7, Math.max(3, Math.ceil(text.length / 70)))}
        className="mt-1.5 w-full rounded-md bg-lavender/60 p-3 text-[15px] leading-relaxed text-ink ring-1 ring-transparent focus:bg-surface focus:outline-none focus:ring-primary disabled:opacity-70"
      />
      {e.status === 'failed' || e.error ? <p className="mt-2 text-[13px] text-[#8a4b00]">{e.error || 'That didn’t go through.'}</p> : null}
      {working ? (
        <p className="mt-4 inline-flex items-center gap-2 text-[14px] text-ink-2"><span className="size-1.5 animate-pulse rounded-full bg-primary" />{e.status === 'posting' ? 'Posting it now…' : 'Approved. It goes out within 15 minutes, one at a time.'}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {mode === 'approve' && !copied ? (
              <Button variant="primary" disabled={!text.trim()} onClick={approve}>{e.status === 'failed' ? 'Try again' : 'Approve'}</Button>
            ) : null}
            {copied ? (
              <Button variant="primary" onClick={posted}><Check className="size-4" /> I posted it</Button>
            ) : (
              <a
                href={e.post_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { void navigator.clipboard?.writeText(text).catch(() => undefined); setCopied(true) }}
                className={`inline-flex h-10 items-center gap-2 rounded-pill px-5 text-[15px] ${mode === 'copy' ? 'bg-primary text-white hover:bg-primary-hover' : 'text-ink-2 hover:bg-primary/8'}`}
              >
                <Copy className="size-4" /> {mode === 'copy' ? 'Copy and open' : 'Post it myself'}
              </a>
            )}
            {copied ? <a href={e.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-pill px-4 text-[14px] text-ink-2 hover:bg-primary/8">Open again <ExternalLink className="size-3.5" /></a> : null}
            <Button variant="ghost" onClick={skip}>Skip</Button>
          </div>
          {copied ? <p className="mt-2 text-[12.5px] text-slate">Copied. Paste it under the post, then tap “I posted it”.</p> : null}
        </>
      )}
    </>
  )
  return flat ? <div>{body}</div> : <Card>{body}</Card>
}
