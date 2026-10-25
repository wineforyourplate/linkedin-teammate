import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Briefcase, CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Flame, HelpCircle, Link2, Mic2, Orbit, Palette, Search, Signpost, Smile, UserRound } from 'lucide-react'
import { usePod } from '@/lib/data'
import { useChatContext } from '@/lib/chat'
import type { Fact } from '@/lib/types'
import { TimeZonePicker, describe } from '@/components/TimeZonePicker'
import { Connections, Question, Rhythm, Rows, WritingStyle } from '@/views/You'
import { cn } from '@/lib/utils'
import { BrandKit } from './BrandKit'
import { WorldPage } from './World'
import { WhereTheyGo } from './WhereTheyGo'
import { DESTS, joinedThisWeek, suggested, watching } from '@/lib/world'
import { ProfileChanges } from '@/views/Skills'
import { LearnedLine } from '@/components/Teach'
import { nudgeTime } from '@/lib/session'
import { useLinkedInLink } from '@/lib/health'
import { Button, Switch } from '@/components/ui'
import type { AppView } from './AppShell'

/* Personalization, as separate pages (the way Notion does settings): one section at a
   time, each at its own address (#/personal/voice). Desktop shows the list beside the
   page; phones show the list first, then the page with a way back. */

type Key = 'profile' | 'world' | 'destination' | 'voice' | 'tone' | 'brand' | 'schedule' | 'connections' | 'about' | 'questions'

const TONES = [
  { key: 'polite', label: 'Polite', line: 'Kind, and starts with what works', icon: Smile },
  { key: 'candid', label: 'Candid', line: 'Plain and direct, no cushioning', icon: Search },
  { key: 'roast', label: 'Roast me', line: 'Playful and witty, still useful', icon: Flame },
] as const

export function Personalize({ go }: { go: (v: AppView, anchor?: string) => void }) {
  useChatContext('Personalization')
  const pod = usePod()
  const { profile: p, facts } = pod
  const link = useLinkedInLink()
  const liBroken = link === 'reauth' || (link === 'none' && !!p?.linkedin_api) || (link === 'unknown' && (p?.health?.linkedin?.state === 'reconnect' || p?.health?.linkedin?.state === 'missing'))
  const of = (s: Fact['section']) => facts.filter((f) => f.section === s && f.kind !== 'question')
  const voice = of('voice')
  const picked = voice.find((f) => f.source === 'you picked it')
  const rules = voice.filter((f) => f !== picked && !/^A post you/i.test(f.label))
  const questions = facts.filter((f) => f.kind === 'question' && !(f.options || []).some((o) => typeof o === 'object'))
  const profileSkill = pod.skills.find((s) => s.key === 'optimize_profile')
  const fixes = (((profileSkill?.settings as { changes?: { applied?: boolean }[] } | null)?.changes) || []).some((c) => !c.applied)
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const raw = (hash.split('/')[2] || '') as Key | 'rhythm' | ''
  const current: Key | '' = raw === 'rhythm' ? 'schedule' : raw
  const open = (k: Key | '') => go('personal', k || undefined)

  const inWorld = watching(pod.world).length
  const toAdd = suggested(pod.world).length
  const joined = joinedThisWeek(pod.world).length
  const dest = DESTS.find((d) => d.kind === p?.destination?.kind)
  const sections: { key: Key; label: string; icon: typeof UserRound; summary: string; show?: boolean }[] = [
    { key: 'profile', label: 'Profile', icon: UserRound, summary: [p?.linkedin_name, p?.timezone ? describe(p.timezone).city : null].filter(Boolean).join(' · ') || 'Who you are, and your time zone' },
    { key: 'world', label: 'Your world', icon: Orbit, summary: inWorld ? [`${inWorld} ${inWorld === 1 ? 'person' : 'people'} I watch for you`, joined ? `${joined} new this week` : null, toAdd ? `${toAdd} to add` : null].filter(Boolean).join(' · ') : 'The people whose posts I watch for you' },
    { key: 'destination', label: 'Where people go', icon: Signpost, summary: dest ? (dest.kind === 'none' ? 'Nothing yet: posts end on a question' : `${dest.title}${p?.destination?.link ? ` · ${p.destination.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}` : ''}`) : 'Where your posts send people' },
    { key: 'voice', label: 'Voice', icon: Mic2, summary: picked ? `Writing as ${picked.value?.split(':')[0]}` : rules.length ? `${rules.length} rules from your posts` : 'Default style until you import posts' },
    { key: 'tone', label: 'Tone', icon: Smile, summary: TONES.find((t) => t.key === (p?.tone || 'candid'))?.label || 'Candid' },
    { key: 'brand', label: 'Brand kit', icon: Palette, summary: p?.brand ? [p.brand.logo || p.brand.wordmark || p.brand.logo_dark ? 'Logo' : null, p.brand.fonts?.heading || 'Inter Tight', `${p.brand.style === 'light' ? 'Light' : p.brand.style === 'brand' ? 'Brand colour' : 'Dark'} slides`].filter(Boolean).join(' · ') : 'Your photo, logo, colours and fonts for carousels' },
    { key: 'schedule', label: 'Schedule', icon: CalendarClock, summary: `${p?.posts_per_week || 2} posts a week around ${p?.posting_time || '08:30'}` },
    { key: 'connections', label: 'Connections', icon: Link2, summary: [liBroken ? 'LinkedIn needs reconnecting' : p?.linkedin_api || link === 'connected' ? 'LinkedIn on' : 'LinkedIn off', p?.browser_status === 'signed_in' ? 'browser signed in' : 'browser signed out'].join(' · ') },
    { key: 'about', label: 'About you', icon: Briefcase, summary: 'What I’ve learned about you and your company' },
    { key: 'questions', label: 'Questions', icon: HelpCircle, summary: `${questions.length} to answer`, show: questions.length > 0 },
  ]
  const visible = sections.filter((s) => s.show !== false)
  const active = visible.find((s) => s.key === current) || null
  const desktopActive = active || visible[0]

  const page = (k: Key): ReactNode => {
    switch (k) {
      case 'profile':
        return (
          <>
            <Block title="On LinkedIn" sub="On every post preview.">
              {p?.linkedin_name ? (
                <div className="flex items-center gap-4">
                  {p.photo_url ? <img src={p.photo_url} alt="" className="size-16 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="grid size-16 place-items-center rounded-full bg-lavender text-[22px]">{p.linkedin_name.charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-[18px] text-ink" style={{ fontWeight: 520 }}>{p.linkedin_name}</p>
                    {p.headline ? <p className="text-[14px] text-ink-2">{p.headline}</p> : null}
                    {p.linkedin_url ? <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] text-primary hover:underline">View on LinkedIn <ExternalLink className="size-3" /></a> : null}
                  </div>
                </div>
              ) : <p className="text-[14px] text-ink-2">Not found yet. Run the introduction again to connect LinkedIn or paste your link.</p>}
            </Block>
            <Block title="Time zone" sub="Your posts and your 10 minutes follow it.">
              <TimeZonePicker />
            </Block>
            {fixes ? (
              <Block title="Profile fixes" sub="From my last check of your profile. Each one is a one-time change.">
                <ProfileChanges skill={profileSkill} />
              </Block>
            ) : null}
            <button type="button" onClick={() => p && void pod.update('profile', p.id, { onboarding_step: 'hello', onboarding_screen: 'profile' })} className="w-fit text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">Run the introduction again</button>
          </>
        )
      case 'world':
        return <WorldPage />
      case 'destination':
        return <WhereTheyGo />
      case 'voice':
        return (
          <Block title="How you write" sub="Import your posts, pick a voice, or change it in conversation.">
            <LearnedLine className="mb-4 rounded-xl bg-lavender px-3 py-2 text-[13.5px] text-ink-2" />
            <WritingStyle rules={rules} picked={picked} />
          </Block>
        )
      case 'tone':
        return (
          <Block title="How honest should I be?" sub="About your profile, drafts and ideas.">
            <div className="grid gap-2 sm:grid-cols-3">
              {TONES.map((t) => {
                const on = (p?.tone || 'candid') === t.key
                return (
                  <motion.button key={t.key} type="button" whileTap={{ scale: 0.97 }} aria-pressed={on} onClick={() => p && void pod.update('profile', p.id, { tone: t.key })} className={cn('flex flex-col items-start gap-1 rounded-2xl p-4 text-left ring-1 transition-colors', on ? 'bg-primary text-on-primary ring-primary' : 'bg-canvas text-ink ring-line hover:bg-lavender')}>
                    <t.icon className="size-5" />
                    <span className="text-[15px]" style={{ fontWeight: 500 }}>{t.label}</span>
                    <span className={cn('text-[13px]', on ? 'text-white/80' : 'text-ink-2')}>{t.line}</span>
                  </motion.button>
                )
              })}
            </div>
          </Block>
        )
      case 'brand':
        return <BrandKit />
      case 'schedule':
        return (
          <>
            <Block title="When posts go out" sub="And when your 10 minutes are ready."><Rhythm /></Block>
            <Nudge />
          </>
        )
      case 'connections':
        return <Block title="What I can reach" sub="I’ll also ask right where something needs one."><Connections /></Block>
      case 'about':
        return (
          <Block title="What I’ve learned" sub="Correct anything. Your version wins.">
            <div className="flex flex-col gap-5">
              {(['you', 'company', 'audience', 'preferences'] as const).map((s) => (of(s).length ? (
                <div key={s}>
                  <p className="mb-1 text-[12px] uppercase tracking-[0.06em] text-slate">{s === 'you' ? 'You' : s === 'company' ? 'Your company' : s === 'audience' ? 'Who you want to reach' : 'Preferences'}</p>
                  <Rows rows={of(s)} />
                </div>
              ) : null))}
            </div>
          </Block>
        )
      case 'questions':
        return <Block title="A few things I don’t know yet" sub="Answer whenever."><div className="flex flex-col gap-5">{questions.map((q) => <Question key={q.id} q={q} />)}</div></Block>
    }
  }

  const wide = desktopActive.key === 'world'
  return (
    <div className={cn('mx-auto', wide ? 'max-w-6xl' : 'max-w-5xl')}>
      {/* phones: the list, or one page with a way back */}
      <div className="md:hidden">
        {active ? (
          <>
            <button type="button" onClick={() => open('')} className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[14px] text-ink-2"><ChevronLeft className="size-4" /> Personalization</button>
            <h1 className="mb-5 text-[28px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{active.label}</h1>
            <div className="flex flex-col gap-4">{page(active.key)}</div>
          </>
        ) : (
          <>
            <h1 className="mb-5 text-[30px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Personalization</h1>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              {visible.map((s) => (
                <li key={s.key}>
                  <button type="button" onClick={() => open(s.key)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary"><s.icon className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[15.5px] text-ink">{s.label}</span><span className="block truncate text-[13px] text-ink-2">{s.summary}</span></span>
                    <ChevronRight className="size-4 text-slate" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {/* desktop: list beside the page */}
      <div className="hidden gap-10 md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="sticky top-8 h-fit" aria-label="Personalization">
          <p className="mb-3 px-3 text-[22px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Personalization</p>
          <ul className="flex flex-col gap-0.5">
            {visible.map((s) => {
              const on = desktopActive.key === s.key
              return (
                <li key={s.key}>
                  <button type="button" onClick={() => open(s.key)} aria-current={on ? 'page' : undefined} className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition-colors', on ? 'bg-primary/10 text-ink' : 'text-ink-2 hover:bg-primary/6 hover:text-ink')} style={{ fontWeight: on ? 500 : 400 }}>
                    <s.icon className="size-4" /> {s.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <motion.div key={desktopActive.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex min-w-0 flex-col gap-5 pt-1">
          <div>
            <h1 className="text-[28px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{desktopActive.label}</h1>
            <p className="mt-1 text-[14px] text-ink-2">{desktopActive.summary}</p>
          </div>
          {page(desktopActive.key)}
        </motion.div>
      </div>
    </div>
  )
}

function Block({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-[17px] text-ink" style={{ fontWeight: 520 }}>{title}</h2>
      {sub ? <p className="mb-4 mt-1 text-[14px] text-ink-2">{sub}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

/** One message on weekdays, half an hour before posts go out, only when something's waiting. */
function Nudge() {
  const pod = usePod()
  const p = pod.profile
  if (!p) return null
  const until = p.nudge_paused_until ? new Date(p.nudge_paused_until) : null
  const paused = !!until && until.getTime() > Date.now()
  const on = !p.nudge_off
  return (
    <Block title="One nudge a day" sub="So you don’t have to remember to open the app.">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] text-ink">Weekdays at {nudgeTime(p.posting_time)}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">Half an hour before your posts, with the draft inside. Only when something’s waiting; never twice.</p>
        </div>
        <Switch checked={on} onChange={(v) => void pod.update('profile', p.id, { nudge_off: !v })} label="Daily nudge" />
      </div>
      {on ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-[13.5px] text-ink-2">
          {paused ? (
            <>
              <span>Paused until {until!.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}.</span>
              <Button size="sm" variant="tint" onClick={() => void pod.update('profile', p.id, { nudge_paused_until: null })}>Resume</Button>
            </>
          ) : (
            <>
              <span>Away for a bit?</span>
              <Button size="sm" variant="ghost" onClick={() => void pod.update('profile', p.id, { nudge_paused_until: new Date(Date.now() + 7 * 86400e3).toISOString() })}>Pause for a week</Button>
            </>
          )}
        </div>
      ) : null}
      <p className="mt-3 text-[12.5px] text-slate">It reaches you wherever Lemma does: your chat app or email.</p>
    </Block>
  )
}
