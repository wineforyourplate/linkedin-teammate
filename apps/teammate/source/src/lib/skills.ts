import type { Profile, Skill, SkillKey } from './types'

export interface SkillInfo {
  key: SkillKey
  name: string
  line: string
  cadence: string
  does: string
  approval: string
  betterWith?: string
  needsBrowser: boolean
}

export interface PlanItem {
  on: boolean
  because?: string
  locked?: string
  /** Shown as-is instead of "Because …". */
  note?: string
}

export const SKILLS: SkillInfo[] = [
  {
    key: 'optimize_profile',
    name: 'Optimize my profile',
    line: 'Your headline, About and Featured, rewritten for who you want to reach',
    cadence: 'Once, then a monthly check',
    does: 'Reads your profile, scores it out of 100 and proposes the top 3 changes. After you approve one, I make it in your browser and check it saved.',
    approval: 'You approve each change',
    betterWith: 'An image tool, for a banner that says what you do',
    needsBrowser: false,
  },
  {
    key: 'post',
    name: 'Post for me',
    line: 'Posts in your voice, in every format, at your times',
    cadence: 'Every morning · posts at your slots',
    does: 'Keeps 3 fresh ideas and a week of drafts ready. Text, images, swipeable PDF carousels, polls. Approved posts go out at their slot.',
    approval: 'You approve each post',
    betterWith: 'The LinkedIn connection: text and image posts go out even when your browser is signed out',
    needsBrowser: false,
  },
  {
    key: 'warm_up',
    name: 'Warm up my account',
    line: 'Reads and likes what’s in your feed, a few minutes a day, so outreach lands safely',
    cadence: 'Twice a day · 14 days',
    does: 'Reads your feed and likes the posts worth liking, views a few profiles in your field and accepts invitations from real people. Likes rise from 5 to 15 a day.',
    approval: 'Within safe limits, every action logged',
    needsBrowser: true,
  },
  {
    key: 'engage',
    name: 'Join conversations',
    line: 'Posts worth commenting on, from your feed and the topics and people you pick, with a comment drafted for you',
    cadence: 'Every session · up to 5 posts',
    does: 'Two sources. First, your feed: what LinkedIn already shows you. Second, what you ask me to watch: topics (say, AI agents or hiring in startups), kinds of people (founders in Bengaluru) and specific accounts. I like the good posts within limits and draft one comment each. You post the comments yourself; LinkedIn doesn’t allow automated ones.',
    approval: 'You post every comment',
    needsBrowser: true,
  },
  {
    key: 'find_people',
    name: 'Find my people',
    line: 'A short, ranked list of people who fit, with the reason for each',
    cadence: 'Daily · you approve the list',
    does: 'Starts with people who commented on your posts, then people discussing what you solve. Read-only: nobody is contacted from this list.',
    approval: 'You approve the list',
    betterWith: 'Sales Navigator for bigger searches · Apollo or Hunter for work emails · your CRM to skip people you already know',
    needsBrowser: true,
  },
  {
    key: 'connect',
    name: 'Send connection requests',
    line: 'Invites to your approved people, ramped from 5 a day',
    cadence: 'Weekdays · within your hours',
    does: 'Invites people you approved, with a short note when there’s a real reason. Pauses if fewer than 30% accept. Withdraws invites older than 21 days.',
    approval: 'Only people you approved',
    betterWith: 'Sales Navigator, for InMail to people who don’t accept',
    needsBrowser: true,
  },
  {
    key: 'follow_up',
    name: 'Follow up',
    line: 'A first message after they accept, one follow-up, then stop',
    cadence: 'When someone accepts',
    does: 'Shows replies you owe first, drafts one message per person in your voice, sends the ones you approve, and stops the moment they reply.',
    approval: 'You approve each message',
    betterWith: 'Gmail and Calendar: follow up by email, stop when a meeting is booked',
    needsBrowser: true,
  },
]

export const skillInfo = (key: string) => SKILLS.find((s) => s.key === key)

/** The status word on a switch: short, in words, never colour alone. */
export function statusWord(skill: Skill | undefined, profile: Profile | null): { text: string; tone: 'on' | 'off' | 'attention' | 'muted' } {
  if (!skill) return { text: 'Off', tone: 'off' }
  const info = skillInfo(skill.key)
  if (skill.state === 'needs_you') return { text: 'Needs you', tone: 'attention' }
  if (skill.state === 'paused') return { text: 'Paused', tone: 'muted' }
  if (skill.state === 'recommended') return { text: 'Suggested', tone: 'attention' }
  if (skill.state === 'on' || skill.state === 'setting_up') {
    if (info?.needsBrowser && profile?.browser_status !== 'signed_in') return { text: 'Needs sign-in', tone: 'attention' }
    if (skill.key === 'warm_up' && skill.day) return { text: `Day ${Math.min(skill.day, 14)} of 14`, tone: 'on' }
    if (skill.key === 'optimize_profile') {
      const changes = ((skill.settings as { changes?: { applied?: boolean }[] } | null)?.changes || []).filter((c) => !c.applied).length
      if (changes) return { text: `${changes} changes`, tone: 'attention' }
      if (skill.status_text?.startsWith('Optimized')) return { text: 'Optimized', tone: 'on' }
    }
    return { text: 'On', tone: 'on' }
  }
  return { text: 'Off', tone: 'off' }
}

/** Which skills to suggest switching on at the end of onboarding, and why ("because you said…"). */
const GOAL_WORDS: Record<string, string> = {
  customers: 'win more customers', leads: 'win more customers',
  hiring: 'hire great people',
  known: 'be known for what you know', credibility: 'be known for what you know',
  audience: 'grow an audience',
  raise: 'raise money', investors: 'raise money',
  back: 'get back into posting',
}
/** "a", "a and b", "a, b and c". */
export function joinWords(words: string[]): string {
  const w = Array.from(new Set(words.filter(Boolean)))
  return w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`
}

export function defaultPlan(profile: Profile | null): Record<SkillKey, PlanItem> {
  const goals = ((profile?.goals as string[] | null) || (profile?.goal ? [profile.goal] : [])).filter(Boolean)
  const said = goals.map((g) => GOAL_WORDS[g]).filter(Boolean)
  const signedIn = profile?.browser_status === 'signed_in'
  const wantsPeople = goals.some((g) => ['customers', 'leads', 'hiring', 'raise', 'investors'].includes(g))
  const firstPeopleGoal = goals.find((g) => ['customers', 'leads', 'hiring', 'raise', 'investors'].includes(g))
  return {
    optimize_profile: { on: true, because: 'everyone who sees your posts lands on your profile next' },
    post: { on: true, because: said.length ? `you said: ${joinWords(said)}` : 'showing up regularly is what everything else builds on' },
    warm_up: signedIn
      ? { on: true, because: 'it keeps your account safe before any outreach' }
      : { on: false, note: 'Works in your own LinkedIn browser. Switch it on and I’ll help you sign in when it starts.' },
    engage: { on: false, note: 'Fresh posts on your topics, with a reply ready. Works in your browser; I’ll help you sign in when it starts.' },
    find_people: wantsPeople
      ? { on: false, because: `you said: ${GOAL_WORDS[firstPeopleGoal as string]}` }
      : { on: false },
    connect: { on: false, locked: 'After warm-up' },
    follow_up: { on: false, locked: 'After your first invitations are accepted' },
  }
}
