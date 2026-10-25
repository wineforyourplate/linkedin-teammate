import { lemmaClient } from '@/lemma-client'

/* Connecting accounts (LinkedIn first) from inside the app. Lemma runs the sign-in
   with the provider and sends the person back here with ?connected=<id>. The app
   never sees a password or token. */

export interface Connector {
  id: string
  name: string
  adds: string
}

/** Shown on the connections screen after LinkedIn. Each says what it adds, in the person's terms. */
export const MORE_CONNECTORS: Connector[] = [
  { id: 'gmail', name: 'Gmail', adds: 'Follow up by email when someone gives you their address' },
  { id: 'google_calendar', name: 'Google Calendar', adds: 'Stop following up once a meeting is booked' },
  { id: 'hubspot', name: 'HubSpot', adds: 'Skip people you already talk to, and log new ones' },
  { id: 'salesforce', name: 'Salesforce', adds: 'Skip people you already talk to, and log new ones' },
  { id: 'apollo', name: 'Apollo', adds: 'Work emails for the people worth knowing' },
]

let org: Promise<string | null> | null = null
export function orgId(): Promise<string | null> {
  if (!org) {
    org = (async () => {
      const pod = lemmaClient.podId
      if (!pod) return null
      const p = (await lemmaClient.pods.get(pod)) as unknown as { organization_id?: string }
      return p.organization_id ?? null
    })().catch(() => {
      org = null
      return null
    })
  }
  return org
}

/** Which of these connectors this person has an account for: connected, needs signing in again, or none. */
export async function accountStatus(userId: string | undefined, ids: string[]): Promise<Record<string, 'connected' | 'reauth' | 'none'>> {
  const out: Record<string, 'connected' | 'reauth' | 'none'> = Object.fromEntries(ids.map((i) => [i, 'none']))
  const o = await orgId()
  if (!o) return out
  try {
    const res = (await lemmaClient.connectors.accounts.list(o, { limit: 100 })) as unknown as { items?: { connector_id: string; status: string; user_id: string }[] }
    for (const a of res.items || []) {
      if (!ids.includes(a.connector_id) || (userId && a.user_id !== userId)) continue
      const s = (a.status || '').toUpperCase()
      if (s === 'CONNECTED' || s === 'ACTIVE') out[a.connector_id] = 'connected'
      else if (out[a.connector_id] !== 'connected') out[a.connector_id] = 'reauth'
    }
  } catch {
    /* leave as none */
  }
  return out
}

export type LinkState = 'connected' | 'reauth' | 'none' | 'unknown'

let link: { at: number; userId?: string; p: Promise<LinkState> } | null = null
let pinned: LinkState | null = null
/** Dev preview only: answer with this instead of asking Lemma, so fake data never meets a real account. */
export const pinLinkedinLink = (s: LinkState) => { pinned = s }
/** Lemma's own word on their LinkedIn account, without calling LinkedIn. Cached for a minute; 'unknown' when it can't be read. */
export function linkedinLink(userId: string | undefined, fresh = false): Promise<LinkState> {
  if (pinned) return Promise.resolve(pinned)
  if (!fresh && link && link.userId === userId && Date.now() - link.at < 60_000) return link.p
  const p = (async (): Promise<LinkState> => {
    const o = await orgId()
    if (!o) return 'unknown'
    const res = (await lemmaClient.connectors.accounts.list(o, { limit: 100 })) as unknown as { items?: { connector_id: string; status: string; user_id: string }[] }
    const mine = (res.items || []).filter((a) => a.connector_id === 'linkedin' && (!userId || a.user_id === userId)).map((a) => (a.status || '').toUpperCase())
    if (mine.includes('CONNECTED') || mine.includes('ACTIVE')) return 'connected'
    return mine.length ? 'reauth' : 'none'
  })().catch(() => 'unknown' as const)
  link = { at: Date.now(), userId, p }
  return p
}

/** Send the person to connect an account. Returns an error message, or never returns (the page moves). */
export async function startConnect(connectorId: string): Promise<string> {
  const o = await orgId()
  if (!o) return 'I couldn’t find your Lemma organization. Try again in a moment.'
  const back = new URL(location.href)
  back.searchParams.set('connected', connectorId)
  try {
    const r = await lemmaClient.connectors.createConnectRequest(o, { connector_id: connectorId, return_to: back.toString() })
    if (r.authorization_url) {
      location.assign(r.authorization_url)
      return ''
    }
    return 'This one isn’t set up in your Lemma organization yet. An admin can enable it in Connectors.'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return /auth.?config|not.*(found|enabled|configured)/i.test(msg)
      ? 'This one isn’t set up in your Lemma organization yet. An admin can enable it in Connectors.'
      : `Couldn’t start the connection: ${msg.slice(0, 140)}`
  }
}

/** True once, right after coming back from connecting `connectorId`; clears the marker from the URL. */
export function justConnected(connectorId: string): boolean {
  const u = new URL(location.href)
  if (u.searchParams.get('connected') !== connectorId) return false
  u.searchParams.delete('connected')
  history.replaceState(history.state, '', u.toString())
  return true
}

export interface LinkedInMe {
  connected: boolean
  first_name?: string | null
  name?: string | null
  headline?: string | null
  photo_url?: string | null
  profile_url?: string | null
  urn?: string | null
  error?: string | null
}

/** Ask LinkedIn who this is, through their connection. About three seconds. */
export async function linkedInMe(): Promise<LinkedInMe> {
  try {
    const r = (await lemmaClient.functions.run('linkedin_me', { input: {} })) as unknown as { output_data?: LinkedInMe }
    return r?.output_data ?? { connected: false }
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** The profile fields to save once they say "That's me". */
export function identityPatch(me: LinkedInMe): Record<string, unknown> {
  return {
    linkedin_name: me.name || null,
    first_name: me.first_name || me.name?.split(' ')[0] || null,
    headline: me.headline || null,
    photo_url: me.photo_url || null,
    linkedin_url: me.profile_url || null,
    linkedin_urn: me.urn || null,
    linkedin_api: !!me.urn,
  }
}
