import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCurrentUser, useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient } from '@/lemma-client'
import type { Activity, Draft, Engagement, Fact, Message, Person, Profile, Recommendation, Review, Skill, Topic, WorldPerson } from './types'

/* Every table here is private to the signed-in person (RLS), so each list is only
   their own rows. Each list is fetched once and kept live by the pod's change
   stream: nothing polls. */

function norm<T>(r: unknown): T {
  const row = r as Record<string, unknown>
  if (row && typeof row.data === 'object' && row.data) {
    const o = { ...(row.data as Record<string, unknown>) }
    for (const k of ['id', 'created_at', 'updated_at', 'user_id']) if (row[k] != null && o[k] == null) o[k] = row[k]
    return o as T
  }
  return row as T
}

const desc = (field: string) => [{ field, direction: 'desc' as const }]

function useTable<T>(tableName: string, opts: { limit?: number; sort?: { field: string; direction: 'asc' | 'desc' }[] } = {}) {
  const live = useLiveRecords({ client: lemmaClient, tableName, limit: opts.limit ?? 200, sort: opts.sort })
  const rows = useMemo(() => (live.records || []).map((r) => norm<T>(r)), [live.records])
  return { rows, loading: live.isLoading, error: live.error, refresh: live.refresh }
}

export interface PodData {
  ready: boolean
  error: string
  profile: Profile | null
  facts: Fact[]
  skills: Skill[]
  recommendations: Recommendation[]
  drafts: Draft[]
  people: Person[]
  messages: Message[]
  engagements: Engagement[]
  activity: Activity[]
  topics: Topic[]
  reviews: Review[]
  /** Everyone in their world: watching, suggested and removed. */
  world: WorldPerson[]
  update: (table: string, id: string, patch: Record<string, unknown>) => Promise<void>
  create: (table: string, row: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  remove: (table: string, id: string) => Promise<void>
  run: (fn: string, input?: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  refreshAll: () => void
}

const Ctx = createContext<PodData | null>(null)
/** For the dev-only screen preview, which supplies a fake pod. */
export const PodContext = Ctx
export const usePod = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePod outside PodProvider')
  return v
}

export function PodProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false)
  const [bootError, setBootError] = useState('')
  const started = useRef(false)
  const { user } = useCurrentUser({ client: lemmaClient })

  // Make sure this person has a profile and one row per skill (idempotent).
  useEffect(() => {
    if (started.current || !user) return
    started.current = true
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const u = user as unknown as { first_name?: string | null; last_name?: string | null; name?: string | null }
    const display = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || undefined
    lemmaClient.functions
      .run('setup_me', { input: { timezone: tz, display_name: display } })
      .then(() => setBooted(true))
      .catch((e: unknown) => {
        setBootError(e instanceof Error ? e.message : String(e))
        setBooted(true)
      })
  }, [user])

  const profile = useTable<Profile>('profile', { limit: 1 })
  const facts = useTable<Fact>('facts', { limit: 400 })
  const skills = useTable<Skill>('skills', { limit: 20 })
  const recommendations = useTable<Recommendation>('recommendations', { limit: 50, sort: desc('created_at') })
  const drafts = useTable<Draft>('drafts', { limit: 300, sort: desc('updated_at') })
  const people = useTable<Person>('people', { limit: 500, sort: desc('updated_at') })
  const messages = useTable<Message>('messages', { limit: 300, sort: desc('updated_at') })
  const engagements = useTable<Engagement>('engagements', { limit: 200, sort: desc('created_at') })
  const activity = useTable<Activity>('activity', { limit: 300, sort: desc('created_at') })
  const topics = useTable<Topic>('topics', { limit: 50, sort: [{ field: 'created_at', direction: 'asc' }] })
  const reviews = useTable<Review>('reviews', { limit: 8, sort: desc('created_at') })
  const world = useTable<WorldPerson>('world', { limit: 400, sort: [{ field: 'created_at', direction: 'asc' }] })

  // setup_me may create the rows after the first fetch: fetch once more when it lands.
  const refreshProfile = profile.refresh
  const refreshSkills = skills.refresh
  useEffect(() => {
    if (!booted) return
    void refreshProfile()
    void refreshSkills()
  }, [booted, refreshProfile, refreshSkills])

  // A write is followed by one re-read of that table, so the screen never depends on
  // the change stream alone (it can lag, or be unavailable behind a dev proxy).
  const refreshers: Record<string, () => Promise<unknown>> = {
    profile: profile.refresh, facts: facts.refresh, skills: skills.refresh, recommendations: recommendations.refresh,
    drafts: drafts.refresh, people: people.refresh, messages: messages.refresh, engagements: engagements.refresh, activity: activity.refresh, topics: topics.refresh, reviews: reviews.refresh, world: world.refresh,
  }
  const refreshRef = useRef(refreshers)
  refreshRef.current = refreshers
  const update = useCallback(async (table: string, id: string, patch: Record<string, unknown>) => {
    await lemmaClient.records.update(table, id, patch)
    void refreshRef.current[table]?.()
  }, [])
  const create = useCallback(async (table: string, row: Record<string, unknown>) => {
    const r = await lemmaClient.records.create(table, row)
    void refreshRef.current[table]?.()
    return (r as unknown as Record<string, unknown>) ?? null
  }, [])
  const remove = useCallback(async (table: string, id: string) => {
    await lemmaClient.records.delete(table, id)
    void refreshRef.current[table]?.()
  }, [])
  const refreshAll = useCallback(() => {
    for (const r of Object.values(refreshRef.current)) void r()
  }, [])

  // The change stream is the primary way rows stay fresh, but it isn't always
  // delivering, so the app also re-reads when the tab comes back into view and on
  // a slow heartbeat while the tab is visible.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAll() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') refreshAll() }, 45000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(t)
    }
  }, [refreshAll])

  const run = useCallback(async (fn: string, input: Record<string, unknown> = {}) => {
    const r = (await lemmaClient.functions.run(fn, { input })) as unknown as { output_data?: Record<string, unknown> }
    return r?.output_data ?? null
  }, [])

  // Ready once the first load lands; later re-reads must never blank the screen.
  const loadedOnce = useRef(false)
  if (!profile.loading && !skills.loading && profile.rows.length && (booted || skills.rows.length >= 7)) loadedOnce.current = true

  const value: PodData = {
    ready: loadedOnce.current,
    error: bootError || (profile.error ? String(profile.error.message || profile.error) : ''),
    profile: profile.rows[0] ?? null,
    facts: facts.rows,
    skills: skills.rows,
    recommendations: recommendations.rows,
    drafts: drafts.rows,
    people: people.rows,
    messages: messages.rows,
    engagements: engagements.rows,
    activity: activity.rows,
    topics: topics.rows,
    reviews: reviews.rows,
    world: world.rows,
    update,
    create,
    remove,
    run,
    refreshAll,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** While a screen waits on the teammate, re-read the named tables every few seconds (bounded). */
export function useWaitFor(active: boolean, tables: string[] = [], everyMs = 4000, maxMs = 180000) {
  const { refreshAll } = usePod()
  useEffect(() => {
    if (!active) return
    const started = Date.now()
    const t = window.setInterval(() => {
      if (Date.now() - started > maxMs) return window.clearInterval(t)
      refreshAll()
    }, everyMs)
    return () => window.clearInterval(t)
  }, [active, refreshAll, everyMs, maxMs, tables.join(',')])
}
