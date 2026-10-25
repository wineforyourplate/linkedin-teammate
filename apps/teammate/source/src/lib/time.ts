const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function ago(iso?: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export function fmtSlot(iso?: string | null, tz?: string | null): string {
  if (!iso) return 'now'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz || undefined })
}

export function today(tz?: string | null): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz || undefined })
}

/** The next posting slot after `after` that isn't already taken, as an ISO string (UTC). */
export function nextSlot(opts: { days?: string[] | null; time?: string | null; tz?: string | null; taken?: string[]; after?: Date }): string {
  const days = (opts.days && opts.days.length ? opts.days : ['tue', 'thu']).map((d) => d.toLowerCase().slice(0, 3))
  const [hh, mm] = (opts.time || '08:30').split(':').map(Number)
  const tz = opts.tz || 'UTC'
  const taken = new Set((opts.taken || []).map((t) => new Date(t).toISOString().slice(0, 16)))
  const start = opts.after || new Date(Date.now() + 15 * 60 * 1000)
  for (let i = 0; i < 21; i++) {
    const probe = new Date(start.getTime() + i * 86400000)
    const local = new Date(probe.toLocaleString('en-US', { timeZone: tz }))
    const dow = DAYS[local.getDay()]
    if (!days.includes(dow)) continue
    // Build the wall-clock time in tz, then convert to UTC via the offset at that moment.
    const wall = new Date(local)
    wall.setHours(hh || 8, mm || 0, 0, 0)
    const offset = local.getTime() - probe.getTime()
    const utc = new Date(wall.getTime() - offset)
    if (utc.getTime() <= start.getTime()) continue
    const key = utc.toISOString().slice(0, 16)
    if (taken.has(key)) continue
    return utc.toISOString()
  }
  return new Date(start.getTime() + 86400000).toISOString()
}
