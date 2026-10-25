import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Pencil } from 'lucide-react'
import { usePod } from '@/lib/data'
import { useChat, useChatContext } from '@/lib/chat'
import { ago } from '@/lib/time'
import type { Fact } from '@/lib/types'
import { Button, Card, Chip, Status, Switch } from '@/components/ui'
import { PageHead } from '@/components/Shell'
import { VoicePicker, useVoiceQuestion } from '@/components/VoicePicker'
import { Topics } from '@/components/Topics'
import { SignInInline } from '@/components/SignIn'
import { startConnect } from '@/lib/connect'
import { useLinkedInLink } from '@/lib/health'
import { cn } from '@/lib/utils'
import { TimeZonePicker } from '@/components/TimeZonePicker'
import { NeedsAccess } from '@/components/NeedsAccess'
import { UploadPosts, useVoiceImport } from './VoiceImport'

/* What the teammate knows, calm: one line per section, open one at a time. How you
   write comes first and opens by default; it's edited in conversation. */

const first = (rows: Fact[]) => rows[0]?.value?.split(/(?<=[.;])\s/)[0] || ''

export function You() {
  useChatContext('You · what I know')
  const pod = usePod()
  const { profile, facts, topics } = pod
  const [open, setOpen] = useState<string | null>('style')
  const of = (section: Fact['section']) => facts.filter((f) => f.section === section && f.kind !== 'question')
  const questions = facts.filter((f) => f.kind === 'question' && !(f.options || []).some((o) => typeof o === 'object'))
  const voice = of('voice')
  const picked = voice.find((f) => f.source === 'you picked it')
  const rules = voice.filter((f) => f !== picked && !/^A post you/i.test(f.label)) // samples of their posts aren't rules
  const signedIn = profile?.browser_status === 'signed_in'
  const live = topics.filter((t) => t.status !== 'paused')

  const sections: { key: string; title: string; summary: string; body: ReactNode; show?: boolean }[] = [
    {
      key: 'style',
      title: 'How you write',
      summary: picked ? `Writing as ${picked.value?.split(':')[0]}` : rules.length ? `${rules.map((r) => r.label).slice(0, 3).join(' · ')}` : 'Still learning, from your posts and every edit',
      body: <WritingStyle rules={rules} picked={picked} />,
    },
    { key: 'you', title: 'You', summary: first(of('you')) || 'Nothing yet', body: <Rows rows={of('you')} /> },
    { key: 'company', title: 'Your company', summary: first(of('company')) || 'Nothing yet', body: <Rows rows={of('company')} /> },
    { key: 'topics', title: 'Topics', summary: live.length ? live.map((t) => t.name).join(' · ') : 'None yet', body: <Topics intro="Each one is researched, drives your post ideas, and finds conversations in Engage." /> },
    { key: 'audience', title: 'Who you want to reach', summary: first(of('audience')) || 'Nothing yet', body: <Rows rows={of('audience')} /> },
    { key: 'brand', title: 'Brand, for carousels', summary: of('brand').map((f) => f.label).join(' · ') || 'Nothing yet', body: <Rows rows={of('brand')} />, show: of('brand').length > 0 },
    { key: 'preferences', title: 'Your preferences', summary: first(of('preferences')), body: <Rows rows={of('preferences')} />, show: of('preferences').length > 0 },
    { key: 'questions', title: 'Questions I still have', summary: `${questions.length} to answer whenever you like`, body: <div className="flex flex-col gap-5">{questions.map((q) => <Question key={q.id} q={q} />)}</div>, show: questions.length > 0 },
    {
      key: 'connections',
      title: 'Connections',
      summary: [profile?.linkedin_api ? 'LinkedIn connected' : 'LinkedIn not connected', signedIn ? 'browser signed in' : 'browser not signed in'].join(' · '),
      body: <Connections />,
    },
    { key: 'rhythm', title: 'Your rhythm', summary: `${profile?.posts_per_week || 2} posts a week around ${profile?.posting_time || '08:30'}`, body: <Rhythm /> },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead title="What I know about you" sub="Correct anything. Your version wins, and I won’t change it back." />
      <Card className="px-5 py-1">
        {sections.filter((x) => x.show !== false).map((x) => (
          <Section key={x.key} title={x.title} summary={x.summary} open={open === x.key} onToggle={() => setOpen((o) => (o === x.key ? null : x.key))}>
            {x.body}
          </Section>
        ))}
      </Card>
      <p className="mt-8 text-[13px] text-slate">
        <button type="button" className="underline-offset-4 hover:underline" onClick={() => profile && void pod.update('profile', profile.id, { onboarding_step: 'hello' })}>Run the introduction again</button>
      </p>
    </div>
  )
}

export function Section({ title, summary, open, onToggle, children }: { title: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="border-t border-line first:border-t-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 py-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] text-ink" style={{ fontWeight: 470 }}>{title}</span>
          {!open ? <span className="mt-0.5 block truncate text-[13.5px] text-ink-2">{summary}</span> : null}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="pb-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function Rows({ rows }: { rows: Fact[] }) {
  if (!rows.length) return <p className="text-[14px] text-ink-2">I haven’t learned this yet.</p>
  return <div className="flex flex-col divide-y divide-line">{rows.map((f) => <FactRow key={f.id} f={f} />)}</div>
}

/* How you write: the style in one place, changed by talking it through. */
export function WritingStyle({ rules, picked }: { rules: Fact[]; picked?: Fact }) {
  const pod = usePod()
  const chat = useChat()
  const voiceQ = useVoiceQuestion()
  const [adding, setAdding] = useState(false)
  const [post, setPost] = useState('')
  const profile = pod.profile
  const voice = useVoiceImport()
  const editStyle = () => {
    const list = rules.map((r) => r.label).join('; ') || 'none yet'
    const context = `Writing style. It lives in the facts table, section voice, one row per rule: ${list}.${picked ? ` Picked voice: ${picked.value?.split(':')[0]}.` : ''} Update those rows in place and lock what I change`.replace(/[[\]]/g, '')
    void chat.send('I want to change how you write for me.', { fresh: true, context })
  }
  const findVoices = () => {
    if (profile) void pod.update('profile', profile.id, { voice_mode: 'found' })
    void chat.task('[onboarding] voices')
  }
  return (
    <div className="flex flex-col gap-4">
      {picked ? (
        <p className="text-[16px] text-ink">Writing as <span style={{ fontWeight: 470 }}>{picked.value?.split(':')[0]}</span>: {picked.value?.split(':').slice(1).join(':').trim()}</p>
      ) : null}
      {rules.length ? (
        <div className="flex flex-col divide-y divide-line">
          {rules.map((r) => (
            <div key={r.id} className="py-3">
              <p className="text-[15px] text-ink" style={{ fontWeight: 450 }}>{r.label}{r.locked ? <span className="ml-2 text-[12px] text-slate" style={{ fontWeight: 380 }}>yours</span> : null}</p>
              {r.value ? <p className="mt-1 line-clamp-2 text-[13.5px] italic leading-relaxed text-ink-2" title={r.value}>{r.value}</p> : null}
            </div>
          ))}
        </div>
      ) : !picked ? (
        <p className="text-[14px] text-ink-2">I learn your style from your public posts, any you paste here, and every edit you make to my drafts.</p>
      ) : null}
      <p className="text-[12.5px] text-slate">{rules.length ? `From your posts and edits${profile?.voice_confidence ? ` · ${profile.voice_confidence}% sure` : ''} · ` : ''}Gets better with every edit you make.</p>
      {voiceQ ? (
        <div className="rounded-md bg-canvas p-4 ring-1 ring-line">
          <p className="mb-3 text-[14px] text-ink">Three voices, from posts that do well in your field. Pick one:</p>
          <VoicePicker q={voiceQ} dark={false} />
        </div>
      ) : profile?.voice_mode === 'found' && !picked ? (
        <p className="flex items-center gap-2 text-[13.5px] text-ink-2"><span className="size-1.5 animate-pulse rounded-full bg-primary" />Finding three voices for you…</p>
      ) : null}
      {adding ? (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (!post.trim()) return; void pod.create('facts', { section: 'voice', kind: 'fact', label: 'A post you liked writing', value: post.trim().slice(0, 3000), source: 'you pasted it', confidence: 1 }); setPost(''); setAdding(false) }}>
          <label htmlFor="liked-post" className="text-[13px] text-ink-2">Paste a post you liked writing. I’ll weigh it above everything else.</label>
          <textarea id="liked-post" value={post} onChange={(e) => setPost(e.target.value)} rows={4} className="rounded-md bg-canvas p-3 text-[15px] text-ink ring-1 ring-line focus:outline-none focus:ring-primary" />
          <div className="flex gap-2"><Button size="sm" variant="primary" type="submit" disabled={!post.trim()}>Add it</Button><Button size="sm" variant="ghost" type="button" onClick={() => setAdding(false)}>Cancel</Button></div>
        </form>
      ) : null}
      <NeedsAccess ask={voice.ask} onReady={voice.fromLinkedIn} onClose={() => voice.setAsk(null)} />
      <UploadPosts open={voice.uploading} onClose={() => voice.setUploading(false)} />
      {profile?.voice_mode === 'mine' && profile?.voice_import !== 'done' && !rules.length ? <p className="text-[13.5px] text-ink-2">Until you import your posts I write in a clean, plain style: short lines, one idea, concrete, no buzzwords.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={editStyle}>Edit style</Button>
        <Button size="sm" onClick={voice.startLinkedIn}>{profile?.voice_import === 'done' ? 'Re-import my posts' : 'Import my posts'}</Button>
        <Button size="sm" onClick={() => voice.setUploading(true)}>Upload posts</Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>Add a post I like</Button>
        <Button size="sm" variant="ghost" onClick={findVoices}>Try a different voice</Button>
      </div>
    </div>
  )
}

export function Connections() {
  const { profile } = usePod()
  const chat = useChat()
  const link = useLinkedInLink()
  const signedIn = profile?.browser_status === 'signed_in'
  const liOn = link === 'connected' || (link === 'unknown' && !!profile?.linkedin_api && profile?.health?.linkedin?.state !== 'reconnect')
  const liBroken = link === 'reauth' || (!liOn && !!profile?.linkedin_api)
  return (
    <ul className="flex flex-col divide-y divide-line">
      <li className="flex items-center justify-between gap-4 py-4">
        <div>
          <p className="text-[15px] text-ink" style={{ fontWeight: 470 }}>LinkedIn connection</p>
          <p className="mt-1 text-[13px] text-ink-2">{liBroken ? 'It stopped working. Reconnect it so posts can go out through LinkedIn again.' : 'Your exact profile, and text, image and link posts go out through LinkedIn itself, even when your browser is signed out.'}</p>
        </div>
        {liOn ? <Status text="On" tone="on" /> : <Button size="sm" variant={liBroken ? 'primary' : 'tint'} onClick={() => void startConnect('linkedin').then((e) => { if (e) void chat.send(`Connecting LinkedIn failed: ${e}. What should I do?`) })}>{liBroken ? 'Reconnect' : 'Connect'}</Button>}
      </li>
      <li className="flex items-center justify-between gap-4 py-4">
        <div>
          <p className="text-[15px] text-ink" style={{ fontWeight: 470 }}>Your Lemma browser</p>
          <p className="mt-1 text-[13px] text-ink-2">For carousels, warm-up, finding people and commenting for you. You type your password there; I never see it.{profile?.browser_checked_at ? ` Checked ${ago(profile.browser_checked_at)}.` : ''}</p>
        </div>
        {signedIn ? <Status text="Signed in" tone="on" /> : <SignInInline label="Sign in" />}
      </li>
      <li className="py-4">
        <p className="text-[15px] text-ink" style={{ fontWeight: 470 }}>Works even better with</p>
        <p className="mt-1 text-[13px] text-ink-2">Gmail and Calendar (follow up by email, stop when a meeting is booked) · Apollo (work emails for your best matches) · HubSpot or Salesforce (skip people you already talk to). Connect them from the introduction’s accounts step, or ask me.</p>
      </li>
    </ul>
  )
}

export function Question({ q }: { q: Fact }) {
  const { update } = usePod()
  const [text, setText] = useState('')
  const answer = (v: string) => void update('facts', q.id, { kind: 'fact', value: v, locked: true, source: 'you told me' })
  const options = (q.options || []).filter((o): o is string => typeof o === 'string')
  if ((q.options || []).some((o) => typeof o === 'object')) {
    return (
      <div>
        <p className="mb-3 text-[16px] text-ink">{q.label}</p>
        <VoicePicker q={q} dark={false} />
      </div>
    )
  }
  return (
    <div>
      <p className="text-[16px] text-ink">{q.label}</p>
      {q.value ? <p className="mt-1 text-[13px] text-ink-2">{q.value}</p> : null}
      {options.length ? (
        <div className="mt-3 flex flex-wrap gap-2">{options.map((o) => <Chip key={o} selected={false} onClick={() => answer(o)}>{o}</Chip>)}</div>
      ) : (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) answer(text.trim()) }}>
          <label htmlFor={`q-${q.id}`} className="sr-only">{q.label}</label>
          <input id={`q-${q.id}`} value={text} onChange={(e) => setText(e.target.value)} className="h-10 flex-1 rounded-pill bg-white px-4 text-[14px] ring-1 ring-line focus:outline-none focus:ring-primary" placeholder="A few words" />
          <Button variant="primary" type="submit" disabled={!text.trim()}>Save</Button>
        </form>
      )}
    </div>
  )
}

export function FactRow({ f }: { f: Fact }) {
  const { update } = usePod()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(f.value || '')
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      {editing ? (
        <form className="flex flex-1 flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void update('facts', f.id, { value, locked: true, source: 'you corrected it' }); setEditing(false) }}>
          <label htmlFor={`fr-${f.id}`} className="text-[12px] text-slate">{f.label}</label>
          <textarea id={`fr-${f.id}`} value={value} onChange={(e) => setValue(e.target.value)} rows={2} className="rounded-md bg-canvas p-3 text-[15px] text-ink ring-1 ring-line focus:outline-none focus:ring-primary" />
          <div className="flex gap-2"><Button size="sm" variant="primary" type="submit">Save</Button><Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button></div>
        </form>
      ) : (
        <>
          <div className="min-w-0">
            <p className="text-[15px] text-ink">{f.value}</p>
            <p className="mt-0.5 text-[12px] text-slate">{f.label}{f.source ? ` · from ${f.source}` : ''}{f.locked ? ' · yours' : ''}</p>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="grid size-8 shrink-0 place-items-center rounded-full text-slate hover:bg-primary/8 hover:text-ink" aria-label={`Edit ${f.label}`}><Pencil className="size-3.5" /></button>
        </>
      )}
    </div>
  )
}

export function Rhythm() {
  const pod = usePod()
  const p = pod.profile
  const [perWeek, setPerWeek] = useState(p?.posts_per_week || 2)
  const [time, setTime] = useState(p?.posting_time || '08:30')
  const [hours, setHours] = useState(p?.working_hours || '09:00-18:00')
  const [saved, setSaved] = useState(false)
  if (!p) return null
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-[14px] text-ink-2">Posts a week</p>
          <div className="mt-2 flex gap-2">{[1, 2, 3, 5].map((n) => <Chip key={n} selected={perWeek === n} onClick={() => setPerWeek(n)}>{n}</Chip>)}</div>
        </div>
        <label className="text-[14px] text-ink-2" htmlFor="pt">Posting time
          <input id="pt" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2 block h-10 w-full rounded-pill bg-canvas px-4 text-[15px] text-ink ring-1 ring-line" />
        </label>
        <label className="text-[14px] text-ink-2" htmlFor="wh">Working hours (I only act on LinkedIn inside them)
          <input id="wh" value={hours} onChange={(e) => setHours(e.target.value)} className="mt-2 block h-10 w-full rounded-pill bg-canvas px-4 text-[15px] text-ink ring-1 ring-line" />
        </label>

        <div className="flex items-center justify-between gap-4 sm:col-span-2">
          <div>
            <p className="text-[15px] text-ink">Weekly 1:1</p>
            <p className="text-[13px] text-ink-2">What happened, what worked, next week’s plan, every Monday.</p>
          </div>
          <Switch checked={p.weekly_review !== false} onChange={(v) => void pod.update('profile', p.id, { weekly_review: v })} label="Weekly 1:1" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button variant="primary" onClick={async () => { await pod.update('profile', p.id, { posts_per_week: perWeek, posting_time: time, working_hours: hours }); setSaved(true); window.setTimeout(() => setSaved(false), 2000) }}>Save</Button>
        {saved ? <span className="text-[13px] text-ink-2">Saved</span> : null}
      </div>
    </div>
  )
}
