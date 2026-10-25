export type SkillKey = 'optimize_profile' | 'post' | 'warm_up' | 'engage' | 'find_people' | 'connect' | 'follow_up'
export type SkillState = 'off' | 'recommended' | 'setting_up' | 'on' | 'needs_you' | 'paused'
export type Step = 'hello' | 'profile' | 'goals' | 'tone' | 'voice' | 'worries' | 'rhythm' | 'deal' | 'browser' | 'learned' | 'plan' | 'first' | 'done' | 'dest'
/** The onboarding's ten screens (profile.onboarding_screen). onboarding_step stays the done gate. */
export type Screen = 'profile' | 'goals' | 'dest' | 'deal' | 'world' | 'signin' | 'reveal' | 'stand' | 'first' | 'week' | 'done'
export type Kpi = 'profile_visits' | 'link_clicks' | 'impressions' | 'followers' | 'comments' | 'recruiter_messages' | 'investor_messages'

export interface Row {
  id: string
  created_at?: string
  updated_at?: string
}

export interface Profile extends Row {
  display_name?: string | null
  first_name?: string | null
  linkedin_url?: string | null
  linkedin_name?: string | null
  linkedin_urn?: string | null
  headline?: string | null
  photo_url?: string | null
  location?: string | null
  profile_confirmed?: boolean | null
  role?: string | null
  company_name?: string | null
  website?: string | null
  goal?: 'leads' | 'hiring' | 'credibility' | 'audience' | 'investors' | null
  why_now?: string | null
  goals?: string[] | null
  goal_note?: string | null
  voice_mode?: 'mine' | 'found' | null
  tone?: 'polite' | 'candid' | 'roast' | null
  voice_import?: 'todo' | 'reading' | 'done' | null
  brand?: BrandKitData | null
  last_seen_at?: string | null // the previous visit, for "While you were away"
  nudged_on?: string | null // the day (YYYY-MM-DD) the daily nudge last went out
  nudge_off?: boolean | null
  nudge_paused_until?: string | null
  skipped?: Step[] | null
  worries?: string[] | null
  meeting_time?: string | null
  brief_channel?: string | null
  agreed_at?: string | null
  first_post_choice?: string | null
  posting_habit?: 'never' | 'rarely' | 'monthly' | 'weekly' | 'daily' | null
  minutes_per_day?: number | null
  posts_per_week?: number | null
  posting_days?: string[] | null
  posting_time?: string | null
  timezone?: string | null
  working_hours?: string | null
  onboarding_step?: Step | null
  browser_status?: 'unknown' | 'signed_in' | 'signed_out' | 'checkpoint' | null
  browser_checked_at?: string | null
  health?: Health | null
  learning_status?: 'idle' | 'running' | 'done' | 'failed' | null
  learning_summary?: string | null
  linkedin_api?: boolean | null
  voice_confidence?: number | null
  weekly_review?: boolean | null
  onboarding_screen?: Screen | null
  kpi_order?: Kpi[] | null
  destination?: Destination | null
  stats?: Stats | null
  news_sources?: string[] | null
  world_status?: 'idle' | 'mapping' | 'done' | 'failed' | null
  world_refreshed_at?: string | null
}

/** What only the person can fix, as the health check last saw it. */
export interface Health {
  linkedin?: { state: 'ok' | 'reconnect' | 'missing' | 'error' | 'unknown' | 'unused'; since?: string | null; checked_at?: string | null; called_at?: string | null; detail?: string | null } | null
  browser?: { state: 'ok' | 'signed_out' | 'checkpoint' | 'unused'; since?: string | null } | null
  told?: Record<string, string> | null
}

export type DestKind = 'product' | 'call' | 'work' | 'hiring' | 'list' | 'none'
/** Where people go after a post lands. Sets how posts end. */
export interface Destination {
  kind: DestKind
  link?: string | null
  detail?: string | null
  /** The teammate's guess from their website, until they confirm it. */
  guess?: boolean | null
}

/** Where they stand: written by learn-about-you, shown in onboarding. */
export interface Stats {
  followers?: number | null
  profile_views_week?: number | null
  impressions_week?: number | null
  best?: { title?: string | null; numbers?: string | null; why?: string | null; url?: string | null } | null
  fixes?: string[] | null
  read_at?: string | null
  from?: string | null
}

export type Bucket = 'voices' | 'deciders' | 'news' | 'builders' | 'peers'
/** One person (or page) in their world. */
export interface WorldPerson extends Row {
  name: string
  url?: string | null
  photo?: string | null
  headline?: string | null
  bucket?: Bucket | null
  cadence?: 'daily' | 'weekly' | 'monthly' | null
  followers?: number | null
  why?: string | null
  status: 'watching' | 'suggested' | 'removed'
  source?: string | null
  removed_reason?: string | null
  last_post_at?: string | null
  last_seen_at?: string | null
  seen_count?: number | null
  added_at?: string | null
  decided_at?: string | null
}

/** An image in the brand kit: a file they uploaded (under /me/brand) or one found on their site. */
export interface BrandImage {
  path?: string | null
  id?: string | null
  url?: string | null
  tone?: 'dark' | 'light' | null // a dark logo reads on light slides, a light one on dark
}

/** The person's brand kit, used for carousels. Person first, then their marks. */
export interface BrandKitData {
  posting_as?: 'me' | 'company' | null
  name?: string | null // on every slide, next to the headshot
  byline?: string | null // handle, headline or website, under the name
  headshot?: boolean | null // show their photo (LinkedIn's, or one they uploaded)
  photo?: BrandImage | null
  logo?: BrandImage | null // a square mark
  logo_dark?: BrandImage | null // the mark for dark slides
  wordmark?: BrandImage | null // the name as a logo, wide
  wordmark_dark?: BrandImage | null
  logo_on?: 'cover_cta' | 'every' | 'never' | null
  colors?: { primary?: string | null; secondary?: string | null; light?: string | null; dark?: string | null } | null
  fonts?: { heading?: string | null; body?: string | null } | null
  style?: 'dark' | 'light' | 'brand' | null
  slide_numbers?: boolean | null
  swipe?: string | null
  cta?: { ask?: 'follow' | 'comment' | 'repost' | 'dm' | 'link' | null; line?: string | null; keyword?: string | null; link?: string | null } | null
  website?: string | null
  /** What the teammate found on their website, waiting for them to keep or skip. */
  suggested?: BrandSuggestion | null
}

export interface BrandSuggestion {
  from?: string | null // the site it came from
  at?: string | null
  logo?: BrandImage | null
  wordmark?: BrandImage | null
  primary?: string | null
  secondary?: string | null
  heading?: string | null
  body?: string | null
  byline?: string | null
  notes?: string | null // what it couldn't find, in a sentence
}

/** A voice the teammate proposes when they ask it to find one. Never named after a real person. */
export interface VoiceOption {
  name: string
  how: string
  sample?: string
}

export interface Fact extends Row {
  section: 'you' | 'company' | 'audience' | 'topics' | 'voice' | 'brand' | 'preferences'
  label: string
  value?: string | null
  kind?: 'fact' | 'question' | null
  options?: (string | VoiceOption)[] | null
  source?: string | null
  confidence?: number | null
  locked?: boolean | null
  position?: number | null
}

export interface Skill extends Row {
  key: SkillKey
  state: SkillState
  status_text?: string | null
  day?: number | null
  started_at?: string | null
  last_run_at?: string | null
  next_run_at?: string | null
  last_result?: string | null
  approval?: 'each' | 'within_limits' | null
  caps?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
}

export interface Recommendation extends Row {
  kind?: 'skill' | 'action' | null
  skill_key?: string | null
  title: string
  why?: string | null
  plan?: string | null
  needs?: string | null
  limits?: string | null
  status?: 'new' | 'accepted' | 'later' | 'dismissed' | null
  snooze_until?: string | null
}

export type DraftStatus = 'idea' | 'drafting' | 'ready' | 'approved' | 'publishing' | 'published' | 'failed' | 'killed'
export interface Draft extends Row {
  title?: string | null
  body?: string | null
  format?: 'text' | 'image' | 'carousel' | 'poll' | 'link' | 'video' | null
  media?: string[] | null
  pdf_path?: string | null
  poll?: { question?: string; options?: string[] } | null
  link_url?: string | null
  status: DraftStatus
  why_now?: string | null
  source?: string | null
  first_draft?: string | null
  scheduled_for?: string | null
  approved_at?: string | null
  published_at?: string | null
  post_url?: string | null
  via?: 'browser' | 'api' | null
  error?: string | null
  reactions?: number | null
  comments?: number | null
  impressions?: number | null
  /** Earlier texts of this draft, oldest first (the composer keeps them). */
  versions?: { at: string; body: string }[] | null
  /** What the post did, read in their browser a day and three days after it went out. */
  results?: { h24?: PostResult | null; h72?: PostResult | null } | null
  led_to_conversation?: boolean | null
}

export interface PostResult {
  at?: string
  reactions?: number | null
  comments?: number | null
  reposts?: number | null
  impressions?: number | null
  profile_views?: number | null
  /** Who reacted or commented that matters: people on their list, founders, their audience. */
  people?: { name: string; headline?: string | null; why?: string | null }[] | null
  why?: string | null // why it worked (or didn't), one line
  try_next?: string | null
}

/** The Monday review: last week, and this week's plan to approve in one go. */
export interface Review extends Row {
  week_of?: string | null
  summary?: string | null
  numbers?: { posts?: number; reactions?: number; comments?: number; people_found?: number; accepted?: number; conversations?: number } | null
  best?: { draft_id?: string; title?: string; line?: string; why?: string } | null
  plan?: { draft_id?: string; title?: string; slot?: string }[] | null
  suggestion?: string | null
  status?: 'new' | 'approved' | 'dismissed' | null
}

export interface Person extends Row {
  name: string
  headline?: string | null
  company?: string | null
  profile_url?: string | null
  reason?: string | null
  score?: number | null
  source?: 'engaged_with_you' | 'search' | 'niche_post' | 'export' | 'manual' | null
  stage: 'found' | 'approved' | 'skipped' | 'invited' | 'accepted' | 'messaged' | 'replied' | 'withdrawn'
  invite_note?: string | null
  invited_at?: string | null
  accepted_at?: string | null
  last_message_at?: string | null
  next_step?: string | null
}

export interface Message extends Row {
  person_id?: string | null
  kind?: 'first' | 'followup' | 'reply' | null
  body: string
  status: 'draft' | 'approved' | 'sent' | 'skipped' | 'failed'
  sent_at?: string | null
  error?: string | null
}

export interface Engagement extends Row {
  post_url: string
  author_name?: string | null
  author_headline?: string | null
  author_url?: string | null
  excerpt?: string | null
  reason?: string | null
  should_like?: boolean | null
  comment_draft?: string | null
  status: 'proposed' | 'liked' | 'approved' | 'posting' | 'commented' | 'skipped' | 'failed'
  done_at?: string | null
  topic?: string | null
  posted_at?: string | null
  comment_url?: string | null
  error?: string | null
  method?: string | null
  posted_via?: 'by_hand' | 'teammate' | 'assistant' | null
  experiment?: string | null
  batch?: string | null
  story?: string | null
  drafted_by?: string | null
  author_photo?: string | null
  author_followers?: number | null
  post_reactions?: number | null
  post_comments?: number | null
  outcome?: EngagementOutcome | null
}

/** What happened to a comment, read back from their notifications. */
export interface EngagementOutcome {
  likes?: number
  replies?: number
  author_replied?: boolean
  repliers?: string[]
  impressions?: number | null
  checked_at?: string
  note?: string
}

/** One of the up-to-3 engage runs a person schedules on the Engage page. */
export interface EngageRun {
  key: string
  label: string
  time: string
  size: number
  on: boolean
  last_run_at?: string | null
}

/** One dated, linked thing people said about a topic this month. */
export interface Signal {
  source: string
  date: string
  metric?: string
  text: string
  url?: string
}

export interface Topic extends Row {
  name: string
  why?: string | null
  source?: 'company' | 'profile' | 'posts' | 'you' | 'research' | null
  status?: 'active' | 'paused' | null
  research_status?: 'idle' | 'running' | 'done' | 'failed' | null
  researched_at?: string | null
  summary?: string | null
  signals?: { working?: Signal[]; not?: Signal[]; asking?: Signal[] } | null
  angles?: { title: string; from?: string }[] | null
  position?: number | null
}

export interface Activity extends Row {
  skill: string
  action: string
  target?: string | null
  detail?: string | null
  result?: 'ok' | 'skipped' | 'postponed' | 'failed' | 'warning' | null
  page_loads?: number | null
}
