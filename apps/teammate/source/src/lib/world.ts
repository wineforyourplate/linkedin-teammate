import type { Bucket, DestKind, Destination, Kpi, WorldPerson } from './types'

/* The person's world and where their posts send people: the five rings, the six
   destinations and how posts end for each, and what gets counted first for each goal.
   Shared by the onboarding and Personalization. */

export const BUCKETS: { key: Bucket; label: string; emoji: string; bg: string; why: string }[] = [
  { key: 'voices', label: 'Voices', emoji: '📣', bg: 'var(--color-lavender)', why: 'big reach in your topics' },
  { key: 'deciders', label: 'Decision-makers', emoji: '🧭', bg: 'var(--color-sky)', why: 'they buy, hire or back' },
  { key: 'news', label: 'News and newsletters', emoji: '🗞️', bg: 'var(--color-butter)', why: 'they write about it first' },
  { key: 'builders', label: 'Builders', emoji: '🛠️', bg: 'var(--color-mint)', why: 'shipping things in your space' },
  { key: 'peers', label: 'Peers', emoji: '🤝', bg: 'var(--color-peach)', why: 'doing what you do' },
]
export const bucketOf = (p: Pick<WorldPerson, 'bucket'>) => BUCKETS.find((b) => b.key === p.bucket) || BUCKETS[0]

/** Why someone is suggested, in a few words. */
export const SOURCE: Record<string, string> = {
  replied: 'Talked to you',
  repeat: 'Kept showing up',
  linkedin: 'LinkedIn suggests',
  map: 'From your map',
  you: 'You added',
}

export const watching = (w: WorldPerson[]) => w.filter((p) => p.status === 'watching')
/** Suggestions still worth answering: one nobody answered in 2 weeks drops off. */
export const suggested = (w: WorldPerson[]) => w.filter((p) => p.status === 'suggested' && Date.now() - new Date(p.last_seen_at || p.created_at || Date.now()).getTime() < 14 * 86400e3)
/** People they added in the last 7 days (Add on a suggestion, a pasted link, someone they named). The map and old lists don't count. */
export const joinedThisWeek = (w: WorldPerson[]) => w.filter((p) => p.status === 'watching' && !!p.decided_at && Date.now() - new Date(p.decided_at).getTime() < 7 * 86400e3)
/** Past this, the world gets hard to read; the weekly review says so. */
export const SOFT_SIZE = 60

// ── goals and what gets counted first ─────────────────────────────────────────

export const GOALS = [
  { key: 'customers', emoji: '🤝', label: 'Win customers', goal: 'leads' },
  { key: 'known', emoji: '🎤', label: 'Be known for what I know', goal: 'credibility' },
  { key: 'audience', emoji: '📣', label: 'Grow an audience', goal: 'audience' },
  { key: 'hired', emoji: '🧑‍💻', label: 'Get hired', goal: 'credibility' },
  { key: 'hiring', emoji: '🙋', label: 'Hire great people', goal: 'hiring' },
  { key: 'raise', emoji: '💸', label: 'Raise money', goal: 'investors' },
] as const

export const KPI_LABEL: Record<Kpi, string> = {
  profile_visits: 'profile visits',
  link_clicks: 'link clicks',
  impressions: 'impressions',
  followers: 'followers',
  comments: 'comments',
  recruiter_messages: 'messages from recruiters',
  investor_messages: 'messages from investors',
}

const KPIS: Record<string, Kpi[]> = {
  customers: ['profile_visits', 'link_clicks', 'impressions', 'followers'],
  known: ['profile_visits', 'impressions', 'followers', 'comments'],
  audience: ['followers', 'impressions', 'profile_visits', 'comments'],
  hired: ['profile_visits', 'recruiter_messages', 'impressions', 'followers'],
  hiring: ['profile_visits', 'link_clicks', 'impressions', 'followers'],
  raise: ['profile_visits', 'investor_messages', 'impressions', 'followers'],
  back: ['impressions', 'followers', 'profile_visits', 'comments'],
}

/** Four things to count, in order: the first goal's top three, then the second goal's top new one. */
export function kpiOrder(goals: string[]): Kpi[] {
  const a = KPIS[goals[0]] || KPIS.known
  const b = (KPIS[goals[1]] || []).filter((k) => !a.slice(0, 3).includes(k))
  return Array.from(new Set([...a.slice(0, 3), ...b, ...a])).slice(0, 4)
}

// ── where people go ───────────────────────────────────────────────────────────

export interface DestOption {
  kind: DestKind
  emoji: string
  title: string
  sub: string
  link?: { label: string; placeholder: string }
  ask?: { question: string; options: string[] }
}

export const DESTS: DestOption[] = [
  { kind: 'product', emoji: '🚀', title: 'Try my product', sub: 'a signup, a trial, a repo', link: { label: 'Your product link', placeholder: 'yourproduct.com' }, ask: { question: 'How do people start?', options: ['Free to start', 'Paid trial', 'Demo only'] } },
  { kind: 'call', emoji: '📅', title: 'Book a call', sub: 'services, consulting', link: { label: 'Your booking link', placeholder: 'cal.com/you/15min' }, ask: { question: 'What is the call?', options: ['A free 15-minute call', 'A paid consultation', 'An intro chat'] } },
  { kind: 'work', emoji: '🧑‍💻', title: 'Hire me', sub: 'open to work, freelance', link: { label: 'Portfolio or CV link', placeholder: 'yourname.com' }, ask: { question: 'Looking for', options: ['Full-time', 'Freelance', 'Either'] } },
  { kind: 'hiring', emoji: '🙋', title: 'Join my team', sub: 'you’re hiring', link: { label: 'Your jobs page', placeholder: 'company.com/careers' }, ask: { question: 'Which roles?', options: ['Engineering', 'Design', 'Sales', 'Other'] } },
  { kind: 'list', emoji: '📨', title: 'Subscribe', sub: 'newsletter, podcast, community', link: { label: 'Where they subscribe', placeholder: 'you.substack.com' }, ask: { question: 'How often?', options: ['Weekly', 'Every 2 weeks', 'Monthly'] } },
  { kind: 'none', emoji: '🌱', title: 'Nothing yet', sub: 'just grow; I’ll suggest one later' },
]
export const destOf = (kind?: DestKind | null) => DESTS.find((d) => d.kind === kind) || null

/** How posts end, for each destination: what most posts do, what proof posts do, and the weekly ask. */
export const LADDERS: Record<DestKind, [string, string][]> = {
  product: [['Most posts', 'end on a real question, with no link'], ['Proof posts', 'invite people to try it, with your tagged link'], ['Once a week', 'an open offer to help someone get set up']],
  call: [['Most posts', 'end on a real question, with no link'], ['Proof posts', 'say what the call is for, with your booking link'], ['Once a week', 'a few open slots this month, DMs open']],
  work: [['Most posts', 'end on a real question'], ['Work posts', 'point to your portfolio or a case study'], ['Once a week', 'the role you want, and that your DMs are open']],
  hiring: [['Most posts', 'end on a real question'], ['Team posts', 'name the role, with your jobs link'], ['Once a week', '“Know someone? Tag them.”']],
  list: [['Most posts', 'end on a real question'], ['Deep posts', 'say the longer version is in your newsletter'], ['Once a week', 'an invitation to subscribe']],
  none: [['Every post', 'ends on a real question, with no link'], ['Your profile', 'says what you do in one line, so curious people can tell'], ['In a month', 'I suggest a destination from who’s reaching out']],
}

/** A destination is ready when it's "nothing yet", or has a link that looks like one. */
export const destReady = (d: Destination | null) => !!d && (d.kind === 'none' || /^\S+\.\S{2,}/.test((d.link || '').trim().replace(/^https?:\/\//, '')))

export const cleanLink = (s: string) => {
  const t = s.trim()
  return !t ? '' : /^https?:\/\//i.test(t) ? t : `https://${t}`
}

// ── LinkedIn links and names ──────────────────────────────────────────────────

/** A LinkedIn profile or company link, made whole; null if it isn't one. */
export function linkedInLink(input: string): string | null {
  const m = input.trim().match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(in|company)\/([^/?#\s]+)/i)
  return m ? `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}/` : null
}

/** "jane-doe-4b2a1" → "Jane Doe": a stand-in until the teammate reads their real name. */
export function nameFromLink(url: string): string {
  const slug = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i)?.[1] || url
  const words = decodeURIComponent(slug).split(/[-_]+/).filter((w) => w && !/\d/.test(w))
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || slug
}

export const sameLink = (a?: string | null, b?: string | null) => !!a && !!b && a.replace(/\/+$/, '').toLowerCase().split('linkedin.com')[1] === b.replace(/\/+$/, '').toLowerCase().split('linkedin.com')[1]

/** 1680000 → "1.7M", 34000 → "34K". */
export function fmtCount(n?: number | null): string {
  if (n == null) return ''
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}K`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

/** What an orbit label shows: a first name, or a short page name ("The Ops Brief"). */
export const firstName = (n: string) => (/^the /i.test(n) || !n.includes(' ') ? n : n.split(' ')[0])
