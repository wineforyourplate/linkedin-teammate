import { useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { usePod } from '@/lib/data'
import { useChat, useChatContext } from '@/lib/chat'
import { SKILLS, statusWord } from '@/lib/skills'
import { ago } from '@/lib/time'
import type { Skill } from '@/lib/types'
import { Button, Card, Eyebrow, Feed, Status, Switch } from '@/components/ui'
import { PageHead } from '@/components/Shell'
import { cn } from '@/lib/utils'

const PAGE_LOADS = 120
const LIKES = 30

export function Skills() {
  useChatContext('Skills')
  const pod = usePod()
  const { activity, profile } = pod
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const todays = activity.filter((a) => a.created_at && new Date(a.created_at) >= dayStart)
  const loads = todays.reduce((n, a) => n + (a.page_loads || 0), 0)
  const likes = todays.filter((a) => a.action === 'like').length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead title="Skills" sub="What your teammate does for you. Switch one on and it starts today." />
      <Card tint className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Eyebrow>Today’s LinkedIn budget, shared by every skill</Eyebrow>
          <span className="text-[13px] text-ink-2 tabular">{loads} of {PAGE_LOADS} pages · {likes} of {LIKES} likes</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white">
          <motion.div className="h-2 rounded-full bg-primary" initial={false} animate={{ width: `${Math.min(100, (loads / PAGE_LOADS) * 100)}%` }} />
        </div>
        <p className="mt-3 text-[13px] text-ink-2">Anything held back by a limit is postponed to tomorrow, never dropped. {profile?.browser_status !== 'signed_in' ? 'Skills that work in your browser wait until you sign in.' : ''}</p>
      </Card>
      <div className="flex flex-col gap-3">
        {SKILLS.map((info) => (
          <SkillRow key={info.key} info={info} skill={pod.skills.find((s) => s.key === info.key)} />
        ))}
      </div>
      <p className="mt-6 text-[13px] text-ink-2">Your weekly 1:1 comes every Monday morning. It’s part of your teammate, not a switch; mute it under You.</p>
    </div>
  )
}

function SkillRow({ info, skill }: { info: (typeof SKILLS)[number]; skill?: Skill }) {
  const pod = usePod()
  const chat = useChat()
  const [open, setOpen] = useState(false)
  const st = statusWord(skill, pod.profile)
  const on = skill?.state === 'on' || skill?.state === 'setting_up' || skill?.state === 'needs_you'
  const log = pod.activity.filter((a) => a.skill === info.key).slice(0, 12)

  const toggle = async (v: boolean) => {
    if (!skill) return
    if (v) {
      const resumed = skill.started_at ? { settings: { ...(skill.settings || {}), resumed_at: new Date().toISOString() } } : {}
      await pod.update('skills', skill.id, { state: 'on', started_at: skill.started_at || new Date().toISOString(), ...resumed })
      if (info.key === 'engage' && !hasWatch(skill) && !pod.topics.length) setOpen(true)
      if (info.needsBrowser && pod.profile?.browser_status !== 'signed_in') void chat.send('[onboarding] sign-in')
    } else {
      await pod.update('skills', skill.id, { state: 'paused' })
    }
  }

  return (
    <Card className="p-0">
      <div className="flex items-center gap-4 p-5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <p className="flex items-center gap-2 text-[16px] text-ink" style={{ fontWeight: 470 }}>
            {info.name}
            <ChevronDown className={cn('size-4 text-slate transition-transform', open && 'rotate-180')} aria-hidden />
          </p>
          <p className="mt-1 text-[14px] text-ink-2">{skill?.status_text && on ? skill.status_text : info.line}</p>
          {info.key === 'engage' && on && !hasWatch(skill) && !pod.topics.length ? <p className="mt-1 text-[13px] text-primary">Watching your feed. Add topics in Posts, or people to watch here →</p> : null}
        </button>
        <Status {...st} />
        <Switch checked={on} onChange={(v) => void toggle(v)} label={info.name} />
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-6 border-t border-line p-5 sm:grid-cols-2">
              <div className="flex flex-col gap-4 text-[14px]">
                <div><Eyebrow>What it does</Eyebrow><p className="mt-1 text-ink">{info.does}</p></div>
                <div><Eyebrow>When</Eyebrow><p className="mt-1 text-ink">{info.cadence}</p></div>
                <div><Eyebrow>Approval</Eyebrow><p className="mt-1 text-ink">{info.approval}</p></div>
                {info.betterWith ? <div><Eyebrow>Works better with</Eyebrow><p className="mt-1 text-ink-2">{info.betterWith}</p></div> : null}
                {info.key === 'warm_up' && skill?.state === 'on' ? <Ramp day={skill.day || 1} /> : null}
                {info.key === 'optimize_profile' ? <ProfileChanges skill={skill} /> : null}
                {info.key === 'engage' ? <WatchSetup skill={skill} /> : null}
              </div>
              <div>
                <Eyebrow>Recently on your account</Eyebrow>
                <div className="mt-3">
                  <Feed items={log.map((a) => ({ id: a.id, text: a.detail || a.action, meta: ago(a.created_at), tone: a.result === 'warning' ? 'warning' : undefined }))} empty="Nothing yet." />
                </div>
                {skill?.last_result ? <p className="mt-4 text-[13px] text-ink-2">Last run: {skill.last_result}</p> : null}
                <Button className="mt-4" variant="ghost" size="sm" onClick={() => void chat.send(`How is ${info.name} going, and what will it do next?`)}>Ask how it’s going</Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}

const RAMP = [5, 5, 6, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15]
function Ramp({ day }: { day: number }) {
  return (
    <div>
      <Eyebrow>The ramp · day {Math.min(day, 14)} of 14</Eyebrow>
      <div className="mt-3 flex h-12 items-end gap-1" role="img" aria-label={`Daily like cap rising from 5 to 15; today is day ${day}`}>
        {RAMP.map((cap, i) => (
          <span key={i} className={cn('flex-1 rounded-t-[3px]', i < day - 1 ? 'bg-primary/50' : i === day - 1 ? 'bg-primary' : 'bg-lavender')} style={{ height: `${(cap / 15) * 100}%` }} />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-slate">Likes a day rise from 5 to 15. After a pause it restarts softly.</p>
    </div>
  )
}

interface Change { part: string; now?: string; next: string; why?: string; points?: number; applied?: boolean; approved?: boolean }
export function ProfileChanges({ skill }: { skill?: Skill }) {
  const pod = usePod()
  const changes = ((skill?.settings as { changes?: Change[] } | null)?.changes || [])
  if (!skill || !changes.length) return null
  const setChange = (i: number, patch: Partial<Change>) => {
    const next = changes.map((c, j) => (j === i ? { ...c, ...patch } : c))
    void pod.update('skills', skill.id, { settings: { ...(skill.settings || {}), changes: next } })
  }
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>Changes I’d make</Eyebrow>
      {changes.map((c, i) => (
        <div key={i} className="rounded-md bg-canvas p-4 ring-1 ring-line">
          <p className="text-[12px] text-slate">{c.part}{c.points ? ` · +${c.points} points` : ''}</p>
          {c.now ? <p className="mt-1 text-[13px] text-slate line-through">{c.now}</p> : null}
          <p className="mt-1 text-[15px] text-ink">{c.next}</p>
          {c.why ? <p className="mt-1 text-[13px] text-ink-2">{c.why}</p> : null}
          <div className="mt-3 flex gap-2">
            {c.applied ? <Status text="Done" tone="on" /> : c.approved ? <Status text="Approved · I’ll make it next" tone="on" /> : (
              <>
                <Button size="sm" variant="primary" onClick={() => setChange(i, { approved: true })}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(c.next).catch(() => undefined); setChange(i, { applied: true }) }}>I’ll paste it myself</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Join conversations: what to watch ---------- */

interface Watch { topics?: string[]; people?: string[]; accounts?: string[] }
const watchOf = (skill?: Skill) => ((skill?.settings || {}) as Watch)
function hasWatch(skill?: Skill) {
  const w = watchOf(skill)
  return !!(w.topics?.length || w.people?.length || w.accounts?.length)
}

/** Step two of joining conversations: beyond the feed, what should I go looking for? */
function WatchSetup({ skill }: { skill?: Skill }) {
  const pod = usePod()
  const w = watchOf(skill)
  const [people, setPeople] = useState<string[]>(w.people || [])
  const [accounts, setAccounts] = useState<string[]>(w.accounts || [])
  const [saved, setSaved] = useState(false)
  const topics = pod.topics.filter((t) => t.status !== 'paused')
  if (!skill) return null
  const save = async () => {
    await pod.update('skills', skill.id, {
      settings: { ...(skill.settings || {}), people, accounts },
      ...(skill.state === 'on' ? {} : { state: 'on', started_at: skill.started_at || new Date().toISOString() }),
    })
    setSaved(true)
  }
  return (
    <div className="flex flex-col gap-4 rounded-md bg-canvas p-4 ring-1 ring-line">
      <div>
        <Eyebrow>What I watch, besides your feed and topics</Eyebrow>
        <p className="mt-1 text-[13px] text-ink-2">I look for fresh posts here every session and bring you the ones worth a comment.</p>
      </div>
      <div>
        <p className="text-[13px] text-ink" style={{ fontWeight: 460 }}>Topics</p>
        <p className="mt-1 text-[13px] text-ink-2">{topics.length ? topics.map((t) => t.name).join(' · ') : 'None yet.'} Your topics live in Posts, so the same ones drive your posts and these conversations.</p>
      </div>
      <Tags label="Kinds of people" placeholder="Founders in Bengaluru, heads of ops at SaaS companies…" values={people} onChange={(v) => { setPeople(v); setSaved(false) }} />
      <Tags label="Specific accounts (profile links)" placeholder="linkedin.com/in/…" values={accounts} onChange={(v) => { setAccounts(v); setSaved(false) }} />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="primary" disabled={!people.length && !accounts.length} onClick={() => void save()}>
          {skill.state === 'on' ? 'Save what to watch' : 'Save and start'}
        </Button>
        {saved ? <span className="text-[13px] text-ink-2">Saved. I’ll use it next session.</span> : null}
      </div>
    </div>
  )
}

function Tags({ label, placeholder, values, onChange, suggested = [] }: { label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void; suggested?: string[] }) {
  const [text, setText] = useState('')
  const id = 'tags-' + label.replace(/\W+/g, '-').toLowerCase()
  const add = (raw: string) => {
    const parts = raw.split(',').map((t) => t.trim()).filter(Boolean).filter((t) => !values.includes(t))
    if (parts.length) onChange([...values, ...parts])
    setText('')
  }
  return (
    <div>
      <label htmlFor={id} className="text-[13px] text-ink" style={{ fontWeight: 460 }}>{label}</label>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface p-2 ring-1 ring-line focus-within:ring-primary">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-pill bg-primary/10 py-1 pl-3 pr-1 text-[13px] text-ink">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-5 place-items-center rounded-full text-slate hover:bg-primary/15 hover:text-ink" aria-label={`Remove ${v}`}><X className="size-3" /></button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) } }}
          onBlur={() => text.trim() && add(text)}
          placeholder={values.length ? '' : placeholder}
          className="min-w-[160px] flex-1 bg-transparent px-2 py-1 text-[14px] text-ink placeholder:text-slate focus:outline-none"
        />
      </div>
      {suggested.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggested.map((t) => (
            <button key={t} type="button" onClick={() => onChange([...values, t])} className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] text-ink-2 ring-1 ring-line hover:bg-lavender">
              <Plus className="size-3" /> {t}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
