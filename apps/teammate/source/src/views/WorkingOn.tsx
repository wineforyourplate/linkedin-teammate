import { useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import type { Activity } from '@/lib/types'
import { Button, Eyebrow } from '@/components/ui'
import type { View } from '@/components/Shell'
import { cn } from '@/lib/utils'
import { PixelGrid } from '@/components/PixelGrid'

/* Day one on Today: what the new teammate is doing right now. Each job reads its
   state from the rows it produces (ideas, the profile score, company facts, voice
   facts), and its live line from the latest activity row. A job with nothing to
   show after a while offers "Start it now", which sends that job as a background
   task. Hidden once everything has landed and day one is over. */

type State = 'working' | 'done' | 'stuck' | 'needs'
interface Job {
  key: string
  title: string
  state: State
  line: string
  action?: { label: string; run: () => void }
}

const MIN = 60 * 1000
const latest = (activity: Activity[], skill: string) => activity.find((a) => a.skill === skill)
const recent = (a: Activity | undefined, mins: number) => !!a?.created_at && Date.now() - new Date(a.created_at).getTime() < mins * MIN

export function WorkingOn({ go, compact = false }: { go: (v: View) => void; compact?: boolean }) {
  const pod = usePod()
  const chat = useChat()
  const { profile, drafts, facts, skills, activity } = pod
  const [site, setSite] = useState('')
  const [nudged, setNudged] = useState<string[]>([])
  const since = profile?.agreed_at ? new Date(profile.agreed_at).getTime() : 0
  const age = since ? Date.now() - since : Infinity
  const nudge = (key: string, text: string) => {
    setNudged((n) => [...n, key])
    void chat.task(text)
  }
  /** Working if anything moved lately or it only just started; otherwise it needs a nudge. */
  const pace = (key: string, a: Activity | undefined, startedAt: number): State => (nudged.includes(key) || recent(a, 10) || Date.now() - startedAt < 15 * MIN ? 'working' : 'stuck')

  const jobs: Job[] = []
  const postSkill = skills.find((s) => s.key === 'post')
  if (postSkill?.state === 'on') {
    const ideas = drafts.filter((d) => d.status === 'idea' || d.status === 'ready')
    const a = latest(activity, 'post')
    jobs.push(
      ideas.length
        ? { key: 'ideas', title: 'Collecting post ideas', state: 'done', line: `${ideas.length} idea${ideas.length > 1 ? 's' : ''} ready to talk through`, action: { label: 'See them', run: () => go('posts') } }
        : {
            key: 'ideas',
            title: 'Collecting post ideas',
            state: pace('ideas', a, new Date(postSkill.started_at || since || Date.now()).getTime()),
            line: a?.detail || 'Reading news in your topics and your company’s updates',
            action: { label: 'Start it now', run: () => nudge('ideas', '[start] The "post" skill is on. Do its first run now: three fresh ideas.') },
          },
    )
  }
  const profileSkill = skills.find((s) => s.key === 'optimize_profile')
  if (profileSkill?.state === 'on') {
    const st = (profileSkill.settings || {}) as { score?: number; changes?: unknown[] }
    const a = latest(activity, 'optimize_profile')
    jobs.push(
      st.score != null || st.changes?.length
        ? { key: 'profile', title: 'Diagnosing your profile', state: 'done', line: `${st.score != null ? `Scored ${st.score}/100` : 'Reviewed'}${st.changes?.length ? ` · ${st.changes.length} changes I’d make` : ''}`, action: { label: 'Review', run: () => go('skills') } }
        : {
            key: 'profile',
            title: 'Diagnosing your profile',
            state: pace('profile', a, new Date(profileSkill.started_at || since || Date.now()).getTime()),
            line: a?.detail || 'Checking your headline, About, photo and banner against what works',
            action: { label: 'Start it now', run: () => nudge('profile', '[start] The "optimize_profile" skill is on. Do its first run now: score my public profile and propose the top 3 changes.') },
          },
    )
  }
  const live = pod.topics.filter((t) => t.status !== 'paused')
  if (live.length) {
    const researched = live.filter((t) => t.research_status === 'done')
    const running = live.find((t) => t.research_status === 'running')
    jobs.push(
      researched.length === live.length
        ? { key: 'topics', title: 'Researching your topics', state: 'done', line: `${live.length} topic${live.length > 1 ? 's' : ''}, this month’s conversation on each`, action: { label: 'See them', run: () => go('posts') } }
        : {
            key: 'topics',
            title: 'Researching your topics',
            state: running || live.some((t) => t.research_status === 'idle') ? pace('topics', latest(activity, 'research'), since || Date.now()) : 'stuck',
            line: latest(activity, 'research')?.detail || `${researched.length} of ${live.length} done${running ? ` · now: ${running.name}` : ''}`,
            action: { label: 'Start it now', run: () => nudge('topics', '[research] Research every active topic that isn’t done yet.') },
          },
    )
  }
  const company = facts.filter((f) => f.section === 'company' && f.kind !== 'question')
  const learning = latest(activity, 'learning')
  if (company.length >= 2) {
    jobs.push({ key: 'company', title: `Researching ${profile?.company_name || 'your company'}`, state: 'done', line: company[0].value?.slice(0, 110) || 'Done', action: { label: 'See it', run: () => go('you') } })
  } else if (!profile?.website && profile?.learning_status === 'done') {
    jobs.push({ key: 'company', title: 'Researching your company', state: 'needs', line: 'I couldn’t find your company’s website. What is it?' })
  } else {
    jobs.push({
      key: 'company',
      title: `Researching ${profile?.company_name || 'your company'}`,
      state: pace('company', learning, since || Date.now()),
      line: learning?.detail || (profile?.website ? `Reading ${profile.website.replace(/^https?:\/\//, '')}` : 'Finding your company’s website'),
      action: { label: 'Start it now', run: () => nudge('company', `[onboarding] company ${profile?.website || 'find it from my profile'}`) },
    })
  }
  const picked = facts.find((f) => f.section === 'voice' && f.source === 'you picked it')
  const awaitingImport = profile?.voice_mode === 'mine' && profile?.voice_import !== 'done' // the voice card on Today covers this
  const rules = facts.filter((f) => f.section === 'voice' && f.kind !== 'question')
  const voiceQ = facts.some((f) => f.section === 'voice' && f.kind === 'question' && (f.options || []).some((o) => typeof o === 'object'))
  if (!awaitingImport) jobs.push(
    picked
      ? { key: 'voice', title: 'Learning your voice', state: 'done', line: `Writing as ${picked.value?.split(':')[0] || 'the voice you picked'}` }
      : voiceQ
        ? { key: 'voice', title: 'Finding you a voice', state: 'done', line: 'Three voices ready. Pick one above.' }
        : rules.length >= 3
          ? { key: 'voice', title: 'Learning your voice', state: 'done', line: `${rules.length} things I noticed in how you write`, action: { label: 'See them', run: () => go('you') } }
          : {
              key: 'voice',
              title: profile?.voice_mode === 'found' ? 'Finding you a voice' : 'Learning your voice',
              state: pace('voice', learning, since || Date.now()),
              line: profile?.voice_mode === 'found' ? 'Studying posts that do well in your field' : 'Reading your public posts',
              action: { label: 'Start it now', run: () => nudge('voice', profile?.voice_mode === 'found' ? '[onboarding] voices' : '[learn]') },
            },
  )

  const open = jobs.some((j) => j.state !== 'done')
  useWaitFor(open, ['drafts', 'skills', 'facts', 'activity', 'topics'], 6000, 30 * MIN)
  if (!open && age > 2 * 24 * 60 * MIN) return null

  return (
    <section className={cn('relative isolate overflow-hidden rounded-xl bg-night text-on-dark', compact ? 'rounded-2xl p-5' : 'p-6 sm:p-7')} aria-label="What your teammate is working on">
      <PixelGrid active={open} className="absolute inset-0 -z-10" />
      <div className="flex items-center gap-3">
        <span className={cn('size-2 rounded-full bg-periwinkle', open && 'animate-pulse')} />
        <Eyebrow className="text-fog">{open ? 'Your teammate is on it' : 'Day one, all in'}</Eyebrow>
      </div>
      <ul className="mt-4 flex flex-col divide-y divide-white/[0.06]">
        {jobs.map((j) => (
          <li key={j.key} className={cn('flex items-start gap-4', compact ? 'py-2.5' : 'py-3.5')}>
            <span className="mt-1 grid size-5 shrink-0 place-items-center">
              {j.state === 'done' ? (
                <span className="grid size-5 place-items-center rounded-full bg-periwinkle text-night"><Check className="size-3" strokeWidth={3} /></span>
              ) : j.state === 'needs' || j.state === 'stuck' ? (
                <AlertCircle className="size-5 text-[#f0c38f]" />
              ) : (
                <span className="relative grid size-5 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-periwinkle/30" />
                  <span className="size-2 rounded-full bg-periwinkle" />
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-[15px] text-on-dark', compact && 'truncate')} style={{ fontWeight: 460 }}>{j.title}</p>
              <p className={cn('mt-0.5 text-fog', compact ? 'truncate text-[13px]' : 'text-[14px]')}>{j.state === 'stuck' ? 'This is taking longer than it should.' : j.line}</p>
              {j.key === 'company' && j.state === 'needs' ? (
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!site.trim() || !profile) return; void pod.update('profile', profile.id, { website: site.trim() }); nudge('company', `[onboarding] company ${site.trim()}`) }}>
                  <label htmlFor="co-site" className="sr-only">Your company website</label>
                  <input id="co-site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourcompany.com" className="h-9 flex-1 rounded-pill border border-white/15 bg-white/[0.04] px-4 text-[14px] text-on-dark placeholder:text-fog/50 focus:border-periwinkle focus:outline-none" />
                  <Button size="sm" variant="primary" type="submit" disabled={!site.trim()}>Read it</Button>
                </form>
              ) : null}
            </div>
            {j.action && (j.state === 'done' || j.state === 'stuck') ? (
              <Button size="sm" variant={j.state === 'stuck' ? 'glass' : 'quiet'} onClick={j.action.run}>{j.action.label}</Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
