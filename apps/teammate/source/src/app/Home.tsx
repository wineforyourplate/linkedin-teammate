import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { usePod } from '@/lib/data'
import { skillInfo } from '@/lib/skills'
import { Button } from '@/components/ui'
import { WorkingOn } from '@/views/WorkingOn'
import { Avatar } from '@/views/Engage'
import { watching } from '@/lib/world'
import { NeedsAccess, type AccessAsk } from '@/components/NeedsAccess'
import { NeedsHelp } from '@/components/NeedsHelp'
import { useHelp, type Help } from '@/lib/health'
import type { AppView } from './AppShell'
import type { ComposeStart } from './Composer'
import { useTenMinutes } from './TenMinutes'
import { NextPostTile, Receipt, ResultsTile, RhythmTile, SetupTile, WeekReview, WriteTile, useSetup } from './HomeParts'

/* Home is today, as blocks you can see: your N minutes with a ring that fills as you go, the
   people in your world, then one block per kind of work (posts to approve, comments to post,
   people to look at, a quick question). Each block opens the 10-minute run. Spool talks from
   the corner, not from the page. */

type Go = (v: AppView, anchor?: string) => void

const BLOCKS = {
  posts: { emoji: '✍️', bg: 'bg-lavender', title: (n: number) => (n === 1 ? 'Approve your post' : `Approve ${n} posts`), each: 2 },
  replies: { emoji: '💬', bg: 'bg-butter', title: (n: number) => `${n} comment${n === 1 ? '' : 's'} to post`, each: 1 },
  people: { emoji: '🤝', bg: 'bg-mint', title: (n: number) => `${n} ${n === 1 ? 'person' : 'people'} to look at`, each: 1 },
  question: { emoji: '👋', bg: 'bg-peach', title: () => 'One quick question', each: 1 },
} as const

export function Home({ go, compose, startSession }: { go: Go; compose: (s: ComposeStart) => void; startSession: () => void }) {
  const pod = usePod()
  const { profile, skills } = pod
  const tz = profile?.timezone
  const [access, setAccess] = useState<AccessAsk | null>(null)
  const help = useHelp()
  const setup = useSetup(go, startSession)
  const ten = useTenMinutes()
  const dayOne = !ten.count && !!profile?.agreed_at && Date.now() - new Date(profile.agreed_at).getTime() < 36 * 3600e3
  const world = watching(pod.world)
  const total = ten.count + ten.doneToday
  const pct = total ? ten.doneToday / total : 0
  const C = 2 * Math.PI * 34
  const blocks = ([
    ['posts', ten.posts.items.length],
    ['replies', ten.replies.items.length],
    ['people', ten.people.items.length],
    ['question', ten.questions.items.length],
  ] as const).filter(([, n]) => n > 0)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-2" style={{ fontWeight: 520 }}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz || undefined })}</p>
          <h1 className="mt-1 text-[38px] leading-[1.04] text-ink sm:text-[46px]" style={{ fontFamily: 'var(--font-display)', fontWeight: 520 }}>{ten.count ? `Your ${ten.minutes} minute${ten.minutes === 1 ? '' : 's'}` : 'All caught up'}</h1>
          <p className="mt-2 text-[15px] text-ink-2">{ten.count ? 'Do them in any order. Everything else I’m doing on my own.' : 'Nothing needs you right now. I’ll bring the next batch at your next run.'}</p>
        </div>
        {total ? (
          <div className="relative size-[84px] shrink-0" role="img" aria-label={`${ten.doneToday} of ${total} done today`}>
            <svg viewBox="0 0 80 80" className="size-full -rotate-90"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(30,26,43,.08)" strokeWidth="8" /><circle cx="40" cy="40" r="34" fill="none" stroke="#1e1a2b" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .5s ease' }} /></svg>
            <div className="absolute inset-0 grid place-items-center text-center leading-none"><div><b className="block text-[21px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 560 }}>{ten.doneToday}/{total}</b><span className="text-[10.5px] text-ink-2">done</span></div></div>
          </div>
        ) : null}
      </header>

      <NeedsHelp items={help} go={go} browser={(h: Help) => setAccess(h.key === 'browser:checkpoint'
        ? { title: 'LinkedIn wants to check it’s you', why: 'Open your LinkedIn browser and finish LinkedIn’s check. Everything I do there is paused until you do, and picks up the moment you’re through.', access: 'browser' }
        : { title: 'Sign in to your LinkedIn browser', why: h.key.startsWith('skill:') ? h.detail : 'Finding posts, replies and people happens in your own LinkedIn browser, at a human pace. It’s paused until you sign in.', access: 'browser' })} />

      {world.length ? (
        <button type="button" onClick={() => go('personal', 'world')} className="-mt-1 flex items-center gap-3 self-start rounded-pill pr-3 text-left hover:bg-ink/5">
          <span className="flex -space-x-2.5">{world.slice(0, 6).map((p) => <Avatar key={p.id} name={p.name} photo={p.photo} size={34} />)}</span>
          <span className="text-[13px] text-ink-2">{world.length} people in your world</span>
        </button>
      ) : null}

      {blocks.length ? (
        <section aria-label="Today" className="flex flex-col gap-2.5">
          {blocks.map(([k, n]) => {
            const b = BLOCKS[k]
            return (
              <button key={k} type="button" onClick={startSession} className={`flex items-center gap-3.5 rounded-[20px] ${b.bg} px-4 py-3.5 text-left transition-shadow hover:shadow-[0_10px_26px_-18px_rgba(30,26,43,.45)]`}>
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/75 text-[20px]" aria-hidden>{b.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] text-ink" style={{ fontWeight: 580 }}>{b.title(n)}</span>
                  <span className="block text-[13px] text-ink-2">about {Math.max(1, n * b.each)} min</span>
                </span>
                <span className="grid size-[30px] shrink-0 place-items-center rounded-full border-2 border-ink/30" aria-hidden />
              </button>
            )
          })}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="lg" onClick={startSession}>{ten.doneToday ? 'Carry on' : 'Start your 10 minutes'}</Button>
            <Button variant="ghost" onClick={() => compose({})}><PenLine className="size-4" /> Write a post</Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => compose({})}><PenLine className="size-4" /> Write a post</Button></div>
      )}

      <Receipt />
      <WeekReview />
      {dayOne ? <div className="[&>section]:h-full"><WorkingOn compact go={(v) => go(v === 'today' ? 'home' : v === 'you' ? 'personal' : (v as AppView))} /></div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ResultsTile go={go} />
        <RhythmTile go={go} />
        <NextPostTile go={go} />
        {setup.complete ? <WriteTile compose={compose} /> : <SetupTile go={go} startSession={startSession} />}
      </div>

      <NeedsAccess ask={access} onReady={() => { for (const s of skills) if (s.state === 'needs_you' && skillInfo(s.key)?.needsBrowser) void pod.update('skills', s.id, { state: 'on' }) }} onClose={() => setAccess(null)} />
    </div>
  )
}
