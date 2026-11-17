import { lemmaClient } from '@/lemma-client'

/* Each person's own clock.

   A timed schedule runs as the person who created it, and every table here is private to its
   owner. So a pod that many people use can't run one shared timer: it would only ever see the
   creator's rows. Instead the bundle ships its timed schedules switched off, as templates
   (engage-tick, nudge, health, morning, the sessions, weekly, research-weekly), and this app gives
   each person their own switched-on copy, named `<template>-u<first 8 of their id>`, visible only
   to them, on their own timezone. Their runs then see their rows, their browser and their
   LinkedIn connection.

   The same holds when someone clones the pod for themselves: their app makes their own copies,
   and any copy that came along with the clone under another person's id is switched off.

   Runs once the onboarding is done (before that, nothing should run on a clock), and again
   whenever their timezone changes. Safe to call on every load: it only creates what's missing and
   fixes what drifted from the template. */

interface ScheduleRow {
  id: string
  name?: string | null
  user_id?: string
  schedule_type?: string
  is_active?: boolean
  agent_name?: string | null
  workflow_name?: string | null
  instruction?: string | null
  config?: Record<string, unknown>
}

const suffix = (userId: string) => `-u${userId.replace(/-/g, '').slice(0, 8)}`

let running: Promise<string> | null = null

/** Make sure this person has a switched-on copy of every timed template. Returns a short note. */
export function ensureMySchedules(userId: string, timezone: string): Promise<string> {
  if (running) return running
  running = sync(userId, timezone).finally(() => {
    running = null
  })
  return running
}

async function listAll(): Promise<ScheduleRow[]> {
  const out: ScheduleRow[] = []
  let pageToken: string | null = null
  for (let i = 0; i < 10; i++) {
    const page = (await lemmaClient.schedules.list({ scheduleType: 'TIME' as never, limit: 100, pageToken })) as unknown as {
      items?: ScheduleRow[]
      next_page_token?: string | null
    }
    out.push(...(page.items || []))
    pageToken = page.next_page_token || null
    if (!pageToken) break
  }
  return out
}

async function sync(userId: string, timezone: string): Promise<string> {
  const end = suffix(userId)
  const all = await listAll()
  // Templates: the bundle's timed schedules, switched off, not anyone's copy.
  const templates = all.filter((s) => s.name && !s.is_active && !/-u[0-9a-f]{8}$/.test(s.name))
  const mine = new Map(all.filter((s) => s.user_id === userId && s.name?.endsWith(end)).map((s) => [s.name as string, s]))
  let made = 0
  let fixed = 0
  // A cloned pod can arrive with someone else's copies (another id's suffix) running as this person.
  // Switch those off, never delete them, so nobody runs two clocks.
  for (const s of all) {
    if (s.user_id === userId && s.is_active && s.name && /-u[0-9a-f]{8}$/.test(s.name) && !s.name.endsWith(end)) {
      await lemmaClient.schedules.update(s.id, { is_active: false } as never)
      fixed++
    }
  }
  for (const t of templates) {
    const name = `${t.name}${end}`
    const config: Record<string, unknown> = { ...(t.config || {}), timezone }
    const have = mine.get(name)
    if (!have) {
      await lemmaClient.schedules.create({
        name,
        schedule_type: 'TIME' as never,
        agent_name: t.agent_name || null,
        workflow_name: t.workflow_name || null,
        instruction: t.instruction || null,
        config,
        visibility: 'PERSONAL',
      })
      made++
    } else if (
      (have.config?.cron as string) !== (config.cron as string) ||
      (have.config?.timezone as string) !== timezone ||
      (have.instruction || null) !== (t.instruction || null) ||
      have.is_active === false
    ) {
      await lemmaClient.schedules.update(have.id, { config, instruction: t.instruction || null, is_active: true } as never)
      fixed++
    }
  }
  return `${templates.length} templates, ${made} created, ${fixed} updated`
}
