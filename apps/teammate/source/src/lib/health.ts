import { useEffect, useRef, useState } from 'react'
import { useCurrentUser } from 'lemma-sdk/react'
import { lemmaClient } from '@/lemma-client'
import { usePod } from '@/lib/data'
import { skillInfo } from '@/lib/skills'
import { fmtSlot } from '@/lib/time'
import { linkedInMe, linkedinLink, type LinkState } from '@/lib/connect'
import type { AppView } from '@/app/AppShell'

/* "Needs your help": the few things only the person can fix. The LinkedIn connection is read
   live from Lemma (free, no call to LinkedIn) and backed by the health check's last word in
   `profile.health`; the browser is as the last browser run left it. Each item names what it
   holds up and the one tap that fixes it. Home shows them all; Spool raises them first. */

export type HelpAct =
  | { kind: 'reconnect'; label: string }
  | { kind: 'browser'; label: string }
  | { kind: 'go'; label: string; view: AppView; anchor?: string }

export interface Help {
  key: string
  emoji: string
  title: string
  detail: string
  act: HelpAct
}

const BROWSER_SKILLS = ['warm_up', 'engage', 'find_people', 'connect', 'follow_up']
const hoursSince = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600e3 : 0)

/** Their LinkedIn account as Lemma sees it, and the clean-up once it works again (coming back from reconnecting reloads the app). */
export function useLinkedInLink(): LinkState {
  const { profile, update } = usePod()
  const { user } = useCurrentUser({ client: lemmaClient })
  const userId = (user as unknown as { id?: string } | null)?.id
  const [state, setState] = useState<LinkState>('unknown')
  useEffect(() => {
    let live = true
    void linkedinLink(userId).then((s) => live && setState(s))
    return () => { live = false }
  }, [userId])

  // Working again: record their LinkedIn id if it's new, and clear the old problem so nothing else still says it's broken.
  const healed = useRef(false)
  useEffect(() => {
    if (state !== 'connected' || !profile || healed.current) return
    const h = profile.health?.linkedin
    if (profile.linkedin_api && (!h || h.state === 'ok')) return
    healed.current = true
    const now = new Date().toISOString()
    void linkedInMe().then((me) => {
      if (!me.connected) return
      void update('profile', profile.id, {
        ...(me.urn ? { linkedin_urn: me.urn, linkedin_api: true } : {}),
        health: { ...(profile.health || {}), linkedin: { state: 'ok', since: now, checked_at: now, called_at: now } },
      })
    })
  }, [state, profile, update])
  return state
}

export function useHelp(): Help[] {
  const { profile, skills, drafts } = usePod()
  const link = useLinkedInLink()
  const out: Help[] = []
  if (!profile) return out

  // the LinkedIn connection: Lemma's live answer wins; the health check fills in when it can't be read
  const h = profile.health?.linkedin
  const relied = !!profile.linkedin_api
  let li: 'reconnect' | 'missing' | 'error' | null = null
  if (link === 'reauth') li = 'reconnect'
  else if (link === 'none') li = relied ? 'missing' : null
  else if (link === 'unknown' && (h?.state === 'reconnect' || h?.state === 'missing')) li = h.state
  else if (h?.state === 'error' && hoursSince(h.since) > 6) li = 'error'
  const next = drafts
    .filter((d) => d.status === 'approved' && d.scheduled_for && new Date(d.scheduled_for).getTime() > Date.now())
    .sort((a, b) => String(a.scheduled_for).localeCompare(String(b.scheduled_for)))[0]
  const holds = next ? `Your ${fmtSlot(next.scheduled_for, profile.timezone)} post can’t go out through LinkedIn until you do.` : 'Posts can’t go out through LinkedIn until you do.'
  if (li === 'reconnect') out.push({ key: 'linkedin:reconnect', emoji: '🔌', title: 'Reconnect LinkedIn', detail: `Your LinkedIn connection stopped working. ${holds} It takes 30 seconds.`, act: { kind: 'reconnect', label: 'Reconnect' } })
  if (li === 'missing') out.push({ key: 'linkedin:missing', emoji: '🔌', title: 'Connect LinkedIn again', detail: `Your LinkedIn connection is gone. ${holds}`, act: { kind: 'reconnect', label: 'Connect' } })
  if (li === 'error') out.push({ key: 'linkedin:error', emoji: '🔌', title: 'LinkedIn isn’t answering', detail: 'I’ve been trying for a few hours. Reconnecting usually fixes it.', act: { kind: 'reconnect', label: 'Reconnect' } })

  // the LinkedIn browser, when something on is waiting on it
  const usesBrowser = skills.some((s) => BROWSER_SKILLS.includes(s.key) && (s.state === 'on' || s.state === 'needs_you' || s.state === 'setting_up'))
  const b = profile.browser_status
  const browserDown = usesBrowser && (b === 'signed_out' || b === 'checkpoint')
  if (browserDown && b === 'signed_out') out.push({ key: 'browser:signed_out', emoji: '🔑', title: 'Sign in to your LinkedIn browser', detail: 'Everything I do in your browser is paused until you do. You type your password there; I never see it.', act: { kind: 'browser', label: 'Sign in' } })
  if (browserDown && b === 'checkpoint') out.push({ key: 'browser:checkpoint', emoji: '🛡️', title: 'LinkedIn wants to check it’s you', detail: 'Finish the check in your LinkedIn browser. Everything there is paused until you do.', act: { kind: 'browser', label: 'Open it' } })

  // a post held back until they fix LinkedIn (the API couldn't take it and they haven't chosen the browser)
  const recent = drafts.filter((d) => d.status === 'failed' && hoursSince(d.approved_at || d.scheduled_for) < 7 * 24)
  const held = recent.filter((d) => d.results?.publish?.held)
  for (const d of held) {
    const fix = d.results?.publish?.held === 'api_error' ? 'check LinkedIn' : d.results?.publish?.held === 'connect' ? 'connect LinkedIn' : 'reconnect LinkedIn'
    out.push({ key: `held:${d.id}`, emoji: '⏳', title: `Your ${fmtSlot(d.scheduled_for, profile.timezone)} post is waiting: ${fix}`, detail: 'Nothing went out. Reconnect LinkedIn (30 seconds), then open the post and schedule it again.', act: { kind: 'reconnect', label: 'Reconnect' } })
  }

  // a post that didn't go out
  const failed = recent.filter((d) => !d.results?.publish?.held)
  if (failed.length) {
    const first = (failed[0].title || failed[0].body || '').split('\n')[0].slice(0, 60)
    out.push({ key: `post:${failed[0].id}`, emoji: '✍️', title: failed.length === 1 ? 'A post didn’t go out' : `${failed.length} posts didn’t go out`, detail: first ? `“${first}” needs another try.` : 'It needs another try.', act: { kind: 'go', label: 'See it', view: 'posts' } })
  }

  // anything else that paused itself, unless the browser item above already covers it
  for (const s of skills.filter((x) => x.state === 'needs_you')) {
    const info = skillInfo(s.key)
    if (browserDown && info?.needsBrowser) continue
    const viaBrowser = !!info?.needsBrowser && b !== 'signed_in'
    out.push({ key: `skill:${s.key}`, emoji: '⏸️', title: `${info?.name || 'A skill'} is paused`, detail: s.status_text || 'It needs you for a minute.', act: viaBrowser ? { kind: 'browser', label: 'Fix it' } : { kind: 'go', label: 'Fix it', view: 'skills' } })
  }
  return out
}
