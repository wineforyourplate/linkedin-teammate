import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PodContext, type PodData } from '@/lib/data'
import { ChatContext, type Block, type ChatApi } from '@/lib/chat'
import type { Fact, Profile, Screen, Step, WorldPerson } from '@/lib/types'
import { Onboarding } from '@/onboarding/Onboarding'
import { App } from '@/app/App'
import { SCREENS } from '@/onboarding/flow'
import { QuickQuestion, useQuickQueue } from '@/views/QuickQuestion'
import { WorkingOn } from '@/views/WorkingOn'
import { Shell, type View } from '@/components/Shell'
import { Today } from '@/views/Today'
import { Posts } from '@/views/Posts'
import { Engage } from '@/views/Engage'
import { You } from '@/views/You'
import type { Draft, Engagement, Person, Topic } from '@/lib/types'
import { Composer } from '@/app/Composer'
import { pinLinkedinLink, type LinkState } from '@/lib/connect'

/* Dev only (never in the deployed bundle): render any onboarding screen, or Today's
   question card, against a fake profile so screens can be checked without touching
   anyone's real rows. Writes stay in memory.
   ?preview=<screen> (profile, goals, dest, deal, world, signin, reveal, stand, first, week)
     &pending=1 (profile found, not confirmed)  &signed=1 (LinkedIn browser signed in)
     &mapping=1 (the world map still running)  &empty=1 (no world, stats or ideas yet)
     &boot=1 (simulate the browser starting)  &skipped=dest,goals
   ?preview=app#/personal/world renders the real app (Home, Personalization…) on fake data.
   ?preview=today renders the quick-question card; ?preview=view:… the older shell. */

const ago = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString()
const TOPICS: Topic[] = [
  { id: 't1', name: 'AI teammates, not tools', why: 'Your headline already argues it', source: 'profile', status: 'active', research_status: 'done', researched_at: ago(20),
    summary: 'The “is AI a tool?” debate is the biggest thread in this space this month.',
    signals: {
      working: [{ source: 'Example source', date: '2026-10-12', metric: '900 reactions', text: 'A sample signal: an argument that delegating to a model is closer to ordering than wielding.', url: 'https://example.com' }],
      not: [{ source: 'Example source', date: '2026-10-15', metric: '0 likes', text: 'A sample signal: abstract “software is dead” takes.' }],
      asking: [{ source: 'Example source', date: '2026-10-12', text: 'A sample question: how do I keep up with tools that keep changing?' }],
    },
    angles: [{ title: 'Tool or teammate? The test is who owns the outcome.', from: 'the sample debate (Oct 12)' }] },
  { id: 't2', name: 'Building in public', why: 'Your most-commented post showed your own teammate', source: 'posts', status: 'active', research_status: 'running', created_at: ago(0.05) },
  { id: 't3', name: 'Real deployments', source: 'posts', status: 'paused', research_status: 'done', researched_at: ago(100) },
]
const DRAFT: Draft = {
  id: 'd1', status: 'drafting', format: 'text', title: 'The model was never the problem',
  body: 'The demo worked. Week three is where it died.\n\nEvery AI pilot I’ve seen stall had the same problem, and it wasn’t the model.\n\nNothing persisted. Nobody reviewed the work. There was nowhere for it to land.\n\nSo we gave our teammate a notebook it rewrites after every job, and a person who approves what changed.\n\nWhat’s the one thing your pilot forgot?',
  versions: [{ at: new Date(Date.now() - 600000).toISOString(), body: 'Most AI pilots die in week three. Here’s why.' }],
}
const COMPOSER_BLOCKS = [
  { kind: 'user' as const, id: 'u1', text: 'Let’s write a text post: why AI pilots stall after the demo.' },
  { kind: 'text' as const, id: 't1', text: 'Here’s a first draft in the preview. Pick a first line, or tell me what to change.\n\n```widget\n{"kind":"hooks","options":["The demo worked. Week three is where it died.","Your AI pilot didn’t fail. It had nowhere to live.","Everyone’s fixing the model. The problem is the review loop."]}\n```\n\n```widget\n{"kind":"tone"}\n```' },
  { kind: 'text' as const, id: 't2', text: 'Reads final to me.\n\n```widget\n{"kind":"schedule"}\n```' },
]
const ENGAGEMENTS: Engagement[] = [
  { id: 'e1', post_url: 'https://example.com/post/1', author_name: 'Sample Author', author_headline: 'Head of Ops at Example Co', excerpt: 'We rolled out an AI assistant to our support team. Week one was great. Week three, nobody trusted its answers because it had no idea what changed last Tuesday.', reason: 'You can add the missing piece: notes the teammate rewrites after every job.', comment_draft: 'week three is where it always breaks. the fix for us wasn’t a better model, it was giving the teammate a notebook it rewrites after every job, and a person who reviews the changes.', status: 'proposed', topic: 'AI teammates, not tools', posted_at: ago(3) },
  { id: 'e2', post_url: 'https://example.com/post/2', author_name: 'Another Founder', author_headline: 'Founder, Example Labs', excerpt: 'Shipping our first internal agent this week. What should I log?', reason: 'A real question you can answer from your own setup.', comment_draft: 'log every action with who approved it. it saved us twice already.', status: 'failed', error: 'Your LinkedIn browser is signed out', topic: 'Building in public', posted_at: ago(9) },
]

const q = new URLSearchParams(location.search)
const EMPTY = q.get('empty') === '1'
// &demo=1: a fuller, invented week for screenshots. &link=reauth|none: the LinkedIn connection's state (default: working).
const DEMO = q.get('demo') === '1'
pinLinkedinLink((q.get('link') as LinkState | null) || 'connected')
// &hello=0: Spool keeps its hello bubble closed (it opens once per visit on a computer).
if (q.get('hello') === '0') try { sessionStorage.setItem('spool.shown', '1') } catch { /* fine */ }
const hrs = (h: number) => new Date(Date.now() + h * 3600e3).toISOString()
const slot = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(8, 30, 0, 0); return d.toISOString() }
const DEMO_DRAFTS: Draft[] = [
  { id: 'dd1', status: 'ready', format: 'text', title: 'Week three is where AI pilots die', body: 'The demo worked. Week three is where it died.\n\nNothing persisted. Nobody reviewed the work. There was nowhere for it to land.', why_now: 'Three people in your world argued about this yesterday', scheduled_for: slot(3) },
  { id: 'dd2', status: 'ready', format: 'carousel', title: 'The five questions we ask before automating anything', body: 'Before we automate a task, we ask five questions.\n\nMost teams skip the third one.', scheduled_for: slot(5) },
  { id: 'dd4', status: 'approved', format: 'text', title: 'Your agent needs a manager, not a prompt', body: 'Your agent doesn’t need a better prompt. It needs a manager.', approved_at: hrs(-3), scheduled_for: slot(1) },
  { id: 'dd3', status: 'published', format: 'text', title: 'We fired our AI tool and hired a teammate', body: 'We fired our AI tool and hired a teammate.', published_at: hrs(-50), impressions: 4310, reactions: 86, comments: 23, results: { h72: { impressions: 4310, reactions: 86, comments: 23, profile_views: 41 } } },
]
// &held=1: a post held back because LinkedIn needs reconnecting (Needs your help shows it).
const HELD = q.get('held') === '1'
const HELD_DRAFT: Draft = { id: 'dh1', status: 'failed', format: 'text', title: 'I have not replaced anyone yet', body: 'Every AI rollout I have been part of was sold as headcount. None of them ended that way.', approved_at: hrs(-26), scheduled_for: hrs(-1), error: 'Held, nothing went out: LinkedIn needs you to reconnect it. Tap Reconnect on Home, then schedule this post again.', results: { publish: { held: 'reconnect' } } }
const DEMO_ENG: Engagement[] = [
  { id: 'de1', post_url: 'https://example.com/post/3', author_name: 'Priya Nair', author_headline: 'COO, 40-person agency', excerpt: 'Hot take: most “AI agents” are cron jobs with a chat box. Change my mind.', reason: 'A decider in your world, 40 minutes ago, 12 comments so far', comment_draft: 'Half agree. The cron job is fine. What’s missing is the review step: we hold every agent action in a queue for one human tap, and that one change took trust from zero to daily use.', status: 'proposed', posted_at: hrs(-0.7), author_followers: 34000, post_reactions: 140, post_comments: 12 },
  { id: 'de2', post_url: 'https://example.com/post/4', author_name: 'Jon Ellis', author_headline: 'Shipping an AI inbox', excerpt: 'We cut our support backlog by 60% with one agent. Here is the boring part nobody shows.', reason: 'A builder you watch, posted 2 hours ago', comment_draft: 'The boring part is the whole product. Which step did you keep a human on, and did it move after the first month?', status: 'proposed', posted_at: hrs(-2), author_followers: 18000, post_reactions: 210, post_comments: 31 },
  ...Array.from({ length: 6 }, (_, i): Engagement => ({ id: `dc${i}`, post_url: `https://example.com/post/c${i}`, author_name: ['Lena Ortiz', 'Daniel Kim', 'Sofia Russo', 'Kofi Mensah', 'Mara Lopes', 'Noah Baker'][i], status: 'commented', done_at: hrs(-20 - i * 9), author_followers: [96000, 12000, 9400, 61000, 8200, 26000][i], outcome: { likes: [14, 9, 6, 22, 4, 11][i], replies: [2, 1, 1, 3, 0, 1][i], author_replied: [true, true, false, true, false, true][i], impressions: [2100, 800, 640, 3900, 300, 1200][i], note: i === 1 ? 'Replied, then viewed your profile' : undefined } })),
]
const DEMO_PEOPLE = [
  { id: 'dp1', name: 'Priya Nair', headline: 'COO, 40-person agency', reason: 'Replied to your comment twice this week', score: 9, source: 'engaged_with_you', stage: 'found' },
  { id: 'dp2', name: 'Daniel Kim', headline: 'Head of Ops at a fintech', reason: 'Liked your post, then viewed your profile', score: 8, source: 'engaged_with_you', stage: 'found' },
  { id: 'dp3', name: 'Mara Lopes', headline: 'Founder, logistics startup', reason: 'Asked the question your product answers', score: 7, source: 'niche_post', stage: 'found' },
] as Person[]

/** A sample world: invented names, a few per ring, two suggestions and one who left. */
const W: [string, WorldPerson['bucket'], number, string, string?][] = [
  ['Asha Raman', 'voices', 412000, 'Writes on AI at work, daily'],
  ['Tom Becker', 'voices', 238000, 'Product and growth essays'],
  ['Lena Ortiz', 'voices', 96000, 'Small-team operations'],
  ['Kofi Mensah', 'voices', 61000, 'No-code automation'],
  ['Priya Nair', 'deciders', 34000, 'COO, 40-person agency'],
  ['Daniel Kim', 'deciders', 12000, 'Head of Ops at a fintech'],
  ['Mara Lopes', 'deciders', 8200, 'Founder, logistics startup'],
  ['The Ops Brief', 'news', 52000, 'Weekly newsletter on operations'],
  ['Ravi Shah', 'news', 21000, 'Covers AI tools for small teams'],
  ['Jon Ellis', 'builders', 18000, 'Shipping an AI inbox'],
  ['Sofia Russo', 'builders', 9400, 'Building agent tooling'],
  ['Noah Baker', 'builders', 26000, 'Open-source workflow engine'],
  ['Emma Clarke', 'peers', 15000, 'Runs a similar product'],
  ['Ibrahim Yusuf', 'peers', 7600, 'Founder in your category'],
  ['Hana Sato', 'peers', 4100, 'Same buyers, different tool'],
]
const ago2 = (h: number) => new Date(Date.now() - h * 3600e3).toISOString()
function fakeWorld(): WorldPerson[] {
  if (EMPTY) return []
  const rows: WorldPerson[] = W.map(([name, bucket, followers, why], i) => ({ id: `w${i}`, name, bucket, followers, why, status: 'watching', source: i === 0 ? 'you' : 'map', cadence: i % 3 ? 'weekly' : 'daily', url: `https://www.linkedin.com/in/${name.toLowerCase().replace(/[^a-z]+/g, '-')}/`, created_at: ago2(40 - i) }))
  if (q.get('mapping') === '1') return rows.slice(0, 6)
  return [
    ...rows,
    { id: 'ws1', name: 'Grace Hall', bucket: 'deciders', followers: 14000, status: 'suggested', source: 'repeat', seen_count: 3, why: 'Her posts on hiring ops turned up in 3 of your runs, with real replies', headline: 'VP Operations, Example Co' },
    { id: 'ws2', name: 'Victor Lima', bucket: 'peers', followers: 5200, status: 'suggested', source: 'replied', seen_count: 2, why: 'Replied to two of your comments this week', headline: 'Founder, Example Labs' },
    { id: 'wr1', name: 'Olivia Grant', bucket: 'voices', followers: 120000, status: 'removed', removed_reason: 'inactive', why: 'No posts in 30 days' },
  ]
}
const IDEAS: Draft[] = [
  { id: 'i1', status: 'idea', title: 'The tool nobody asked for is the one that sticks', why_now: 'Three people in your world argued about AI adoption this week; you have the counter-example.', source: 'From your world · this week', created_at: ago2(0.2) },
  { id: 'i2', status: 'idea', title: 'What we stopped doing when the teammate joined', why_now: 'Your best post was a before and after. This is the same shape.', source: 'Like your best post', created_at: ago2(0.21) },
  { id: 'i3', status: 'idea', title: 'Why our onboarding asks five questions, not fifty', why_now: 'From your company: you shipped a new onboarding this month.', source: 'From your work', created_at: ago2(0.22) },
]
const BODY = 'Everyone asked for a smarter model.\n\nWhat changed our week was smaller: the teammate writes down what it learned after every job, and someone reviews it on Friday.\n\nTwo months in, the notes are the product.\n\nWhat does your team write down after the work is done?'
const VOICES = [
  { name: 'The plain-spoken builder', how: 'Short sentences, one idea per line, ends on what you’d do next.', sample: 'We shipped an AI teammate to a 12-person team last month. Nobody asked for a chatbot. They asked for fewer tabs. That’s the whole lesson.' },
  { name: 'Field notes', how: 'A dated observation from real work, then the pattern behind it.', sample: 'Week 3 of deploying agents inside a sales team: the wins came from the boring parts. Reading the CRM. Drafting the follow-up. Nobody noticed the AI.' },
  { name: 'The patient teacher', how: 'Opens with a common mistake, explains why, gives one fix.', sample: 'Most teams add a new AI tool for every problem. Then they spend the quarter learning tools. Teach the tools you have instead. Here is how we do it.' },
]

function fakeProfile(step: Step, screen: Screen | null): Profile {
  const pending = q.get('pending') === '1'
  const signed = q.get('signed') === '1' || DEMO
  return {
    id: 'preview',
    onboarding_step: step,
    onboarding_screen: screen,
    goals: ['customers', 'known'],
    kpi_order: ['profile_visits', 'link_clicks', 'impressions', 'followers'],
    destination: q.get('guess') === '1' ? { kind: 'product', link: 'https://northwind.example', guess: true } : null,
    world_status: q.get('mapping') === '1' ? 'mapping' : EMPTY ? 'idle' : 'done',
    news_sources: EMPTY ? [] : ['A weekly ops newsletter', 'Product launch sites'],
    stats: EMPTY ? null : { followers: 1840, profile_views_week: signed ? 212 : null, impressions_week: signed ? 4310 : null, best: { title: 'Your post on the five-question onboarding', numbers: '6,120 impressions, 5x your usual', why: 'It opened with a number and contrasted two ways of working. Your top posts all do that.' }, fixes: ['Your headline says what you are, not who you help. Add who you help and one result.', 'Your featured section is empty, so curious visitors have nowhere to go.'] },
    profile_confirmed: !pending && (screen || step) !== 'profile',
    linkedin_name: pending || (screen || step) !== 'profile' ? 'Sam Rivera' : null,
    first_name: 'Sam',
    headline: pending || (screen || step) !== 'profile' ? 'Founder at Northwind · AI for small teams' : null,
    linkedin_url: screen === 'profile' && !pending ? null : 'https://www.linkedin.com/in/sam-rivera-demo',
    learning_status: 'running',
    skipped: (q.get('skipped')?.split(',').filter(Boolean) as Step[]) || null,
    posting_time: q.get('skipped')?.includes('rhythm') ? '08:30' : null,
    posts_per_week: 2,
    browser_status: signed ? 'signed_in' : 'unknown',
    photo_url: null,
    timezone: 'Asia/Kolkata',
    company_name: 'Northwind',
    voice_mode: (q.get('voice') as 'mine' | 'found' | null) || null,
    voice_import: (q.get('import') as 'todo' | 'reading' | 'done' | null) || null,
    agreed_at: new Date(Date.now() - 4 * 60000).toISOString(),
  }
}

export function Preview() {
  const which = q.get('preview') || 'profile'
  const isView = which.startsWith('view:')
  const isApp = which === 'app'
  const screen = (SCREENS as string[]).includes(which) ? (which as Screen) : null
  const step = (which === 'today' || isView || isApp ? 'done' : screen ? 'hello' : which) as Step
  const [profile, setProfile] = useState<Profile>(() => fakeProfile(step, screen))
  const [world, setWorld] = useState<WorldPerson[]>(fakeWorld)
  const [drafts, setDrafts] = useState<Draft[]>(() => [...(DEMO ? [...DEMO_DRAFTS, DRAFT] : EMPTY || !screen ? [DRAFT] : [DRAFT, ...IDEAS]), ...(HELD ? [HELD_DRAFT] : [])])
  const [topics, setTopics] = useState<Topic[]>(() => (EMPTY ? [] : TOPICS))
  const [facts, setFacts] = useState<Fact[]>(() =>
    [
      ...(q.get('voices') === '1' ? [{ id: 'v', section: 'voice', kind: 'question', label: 'Pick a voice', options: VOICES, source: 'posts that do well in your field' } as Fact] : []),
      ...(q.get('preview')?.startsWith('view:') ? ([
        { id: 'f1', section: 'voice', kind: 'fact', label: 'Opens with a belief, then flips it', value: 'Sample: “Most teams think X. But what if Y?”', source: 'your posts' },
        { id: 'f2', section: 'voice', kind: 'fact', label: 'Short lines, one idea each', value: 'Sample: “No tool-hopping. Just outcomes.”', source: 'your posts', locked: true },
        { id: 'f3', section: 'you', kind: 'fact', label: 'Role', value: 'Founder at Northwind. Builds AI for small teams.', source: 'your LinkedIn profile' },
        { id: 'f4', section: 'company', kind: 'fact', label: 'What it does', value: 'Northwind makes AI teammates for small teams.', source: 'your website' },
        { id: 'f5', section: 'company', kind: 'question', label: 'Can I name customers in posts?', options: ['Ask me each time', 'Never'] },
      ] as Fact[]) : []),
    ],
  )
  const log = (...a: unknown[]) => console.info('[preview]', ...a)
  const pod: PodData = {
    ready: true,
    error: '',
    profile,
    facts,
    skills: [
      { id: 's1', key: 'post', state: 'on', started_at: new Date(Date.now() - 3 * 60000).toISOString() },
      { id: 's3', key: 'engage', state: 'on', started_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 's2', key: 'optimize_profile', state: 'on', started_at: new Date(Date.now() - 20 * 60000).toISOString(), settings: q.get('scored') === '1' ? { score: 58, changes: [{}, {}, {}] } : {} },
    ],
    recommendations: [],
    drafts,
    people: DEMO ? DEMO_PEOPLE : [],
    messages: [],
    engagements: DEMO ? DEMO_ENG : ENGAGEMENTS,
    topics,
    reviews: [],
    world,
    activity: [
      { id: 'a1', skill: 'learning', action: 'read', detail: 'Reading northwind.ai: pricing and customers', created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'a2', skill: 'post', action: 'read', detail: 'Reading this week’s news on AI agents', created_at: new Date(Date.now() - 30000).toISOString() },
    ],
    update: async (table, id, patch) => {
      log('update', table, id, patch)
      if (table === 'profile') setProfile((p) => ({ ...p, ...patch }) as Profile)
      if (table === 'facts') setFacts((f) => f.map((x) => (x.id === id ? ({ ...x, ...patch } as Fact) : x)))
      if (table === 'world') setWorld((w) => w.map((x) => (x.id === id ? ({ ...x, ...patch } as WorldPerson) : x)))
      if (table === 'drafts') setDrafts((d) => d.map((x) => (x.id === id ? ({ ...x, ...patch, updated_at: new Date().toISOString() } as Draft) : x)))
    },
    create: async (table, row) => {
      log('create', table, row)
      const id = `${table}-${Date.now()}`
      if (table === 'world') setWorld((w) => [...w, { ...row, id } as unknown as WorldPerson])
      if (table === 'topics') setTopics((t) => [...t, { ...row, id } as unknown as Topic])
      return { id }
    },
    remove: async (table, id) => {
      log('remove', table, id)
      if (table === 'world') setWorld((w) => w.filter((x) => x.id !== id))
      if (table === 'topics') setTopics((t) => t.filter((x) => x.id !== id))
    },
    run: async () => null,
    refreshAll: () => undefined,
  }
  return (
    <PodContext.Provider value={pod}>
      <FakeChat onTask={(text) => {
        // the teammate's answers, faked on a timer
        const id = text.split(' ')[2]
        if (text.startsWith('[onboarding] draft')) window.setTimeout(() => setDrafts((d) => d.map((x) => (x.id === id ? { ...x, status: 'ready', body: BODY, first_draft: BODY, updated_at: new Date().toISOString() } : x))), 2500)
        if (text.startsWith('[onboarding] react')) window.setTimeout(() => setDrafts((d) => d.map((x) => (x.id === id ? { ...x, body: BODY.replace('Everyone asked for a smarter model.', 'We all wanted a smarter model.'), updated_at: new Date().toISOString() } : x))), 2500)
      }}>
        {which === 'composer' ? <Composer start={{ draft: DRAFT }} onClose={() => undefined} onDone={() => console.info('[preview] done')} /> : isApp ? <App /> : isView ? <ViewPreview start={which.slice(5) as View} /> : which === 'today' ? <TodayCard /> : <Onboarding />}
        {!isApp && !DEMO ? <p className="pointer-events-none fixed bottom-2 right-3 z-50 rounded-pill bg-black/60 px-3 py-1 text-[11px] text-white/80">preview · {profile.onboarding_screen || profile.onboarding_step}</p> : null}
      </FakeChat>
    </PodContext.Provider>
  )
}

function ViewPreview({ start }: { start: View }) {
  const [view, setView] = useState<View>(start)
  return (
    <Shell view={view} setView={setView}>
      {view === 'today' && <Today go={setView} />}
      {view === 'posts' && <Posts />}
      {view === 'engage' && <Engage />}
      {view === 'you' && <You />}
      {view === 'skills' || view === 'people' ? <p className="text-ink-2">Not in the preview.</p> : null}
    </Shell>
  )
}

function TodayCard() {
  const quick = useQuickQueue()
  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-[28px] text-ink">Monday, 19 October</h1>
        <div className="flex flex-col gap-4">
          <WorkingOn go={(v) => console.info('[preview] go', v)} />
          <QuickQuestion q={quick} />
        </div>
        {!quick.queue.length ? <p className="text-ink-2">No questions left.</p> : null}
      </div>
    </div>
  )
}

/** A chat that answers the browser sign-in like the real teammate would, on a timer. */
function FakeChat({ children, onTask }: { children: ReactNode; onTask?: (text: string) => void }) {
  const [blocks, setBlocks] = useState<Block[]>(q.get('preview') === 'composer' ? COMPOSER_BLOCKS : [])
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (!started || q.get('boot') !== '1') return
    const t1 = window.setTimeout(() => setBlocks([{ kind: 'steps', id: 's', steps: [{ id: '1', text: 'Looked at your data', failed: false }] }]), 2500)
    const t2 = window.setTimeout(() => setBlocks((b) => [...b, { kind: 'steps', id: 's2', steps: [{ id: '2', text: 'Worked in your browser', failed: false }] }]), 6000)
    const t3 = window.setTimeout(() => setBlocks((b) => [...b, { kind: 'signin', id: 'si', toolCallId: 'tc', origin: 'linkedin.com', done: false }]), 10000)
    return () => [t1, t2, t3].forEach((t) => window.clearTimeout(t))
  }, [started])
  const api: ChatApi = useMemo(
    () => ({
      blocks,
      running: started,
      conversationId: 'preview',
      error: '',
      isOpen: false,
      open: () => undefined,
      close: () => undefined,
      toggle: () => undefined,
      send: async (text) => {
        console.info('[preview] send', text)
        setStarted(true)
        return 'preview'
      },
      task: async (text) => {
        console.info('[preview] task', text)
        onTask?.(text)
        return 'preview-task'
      },
      newChat: () => undefined,
      setContext: () => undefined,
      signInLink: () => '#signin',
    }),
    [blocks, started], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return <ChatContext.Provider value={api}>{children}</ChatContext.Provider>
}
