import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock, MapPin, Search } from 'lucide-react'
import { usePod } from '@/lib/data'
import { cn } from '@/lib/utils'

/* Picking a time zone the way people think about it: by city, with the local time
   showing so the right one is recognisable at a glance ("11:42 · that's me"). The
   zone the device reports is offered first and confirmed in one tap; anything else
   is a search by city, country, abbreviation or offset. Saved as an IANA name, so
   daylight saving is handled for them. */

const POPULAR = ['Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Dubai', 'Australia/Sydney']

/** Country hints for searching, for the zones people most often look for by country. */
const COUNTRY: Record<string, string> = {
  'Asia/Kolkata': 'India Bengaluru Bangalore Mumbai Delhi Chennai Hyderabad Pune', 'America/New_York': 'United States USA New York Boston Miami Toronto', 'America/Los_Angeles': 'United States USA San Francisco Seattle LA',
  'America/Chicago': 'United States USA Chicago Texas Austin Dallas', 'Europe/London': 'United Kingdom UK England London', 'Europe/Berlin': 'Germany Berlin Munich', 'Europe/Paris': 'France Paris',
  'Asia/Singapore': 'Singapore', 'Asia/Dubai': 'UAE United Arab Emirates Dubai', 'Australia/Sydney': 'Australia Sydney', 'Asia/Tokyo': 'Japan Tokyo', 'Europe/Amsterdam': 'Netherlands Amsterdam', 'America/Sao_Paulo': 'Brazil Sao Paulo',
}

function allZones(): string[] {
  const f = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
  try {
    return f ? f('timeZone') : POPULAR
  } catch {
    return POPULAR
  }
}

export function describe(zone: string, now = new Date()) {
  const city = (zone.split('/').pop() || zone).replace(/_/g, ' ')
  const region = zone.includes('/') ? zone.split('/')[0].replace(/_/g, ' ') : ''
  let time = ''
  let offset = ''
  let name = ''
  try {
    time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(now)
    offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || ''
    name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || ''
  } catch {
    /* an unknown zone: show the name only */
  }
  return { zone, city, region, time, offset: offset.replace('GMT', 'UTC'), name }
}

export function TimeZonePicker({ onSaved }: { onSaved?: () => void }) {
  const pod = usePod()
  const p = pod.profile
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone
  const saved = p?.timezone || null
  const [now, setNow] = useState(new Date())
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(t)
  }, [])
  const zones = useMemo(() => allZones(), [])
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const pool = needle ? zones : Array.from(new Set([device, ...POPULAR].filter(Boolean)))
    return pool
      .map((z) => describe(z, now))
      .filter((d) => !needle || [d.city, d.region, d.zone, d.name, d.offset, COUNTRY[d.zone] || ''].join(' ').toLowerCase().includes(needle.replace(/^\+/, '+')))
      .slice(0, 40)
  }, [q, zones, device, now])
  const choose = (zone: string) => {
    if (p) void pod.update('profile', p.id, { timezone: zone })
    setQ('')
    setOpen(false)
    onSaved?.()
  }
  const cur = saved ? describe(saved, now) : null
  const dev = describe(device, now)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-lavender text-primary"><Clock className="size-4" /></span>
        <div className="min-w-0 flex-1">
          {cur ? (
            <>
              <p className="text-[16px] text-ink" style={{ fontWeight: 480 }}>{cur.city} <span className="text-ink-2" style={{ fontWeight: 380 }}>· {cur.time} now</span></p>
              <p className="text-[13px] text-slate">{cur.name}{cur.offset ? ` (${cur.offset})` : ''}. Your posts and your 10 minutes follow this.</p>
            </>
          ) : (
            <p className="text-[16px] text-ink">No time zone yet. I’m using {dev.city} until you pick one.</p>
          )}
        </div>
      </div>
      {saved !== device ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-lavender/60 p-3 text-[14px] text-ink">
          <MapPin className="size-4 text-primary" />
          <span className="flex-1">Your device says <strong style={{ fontWeight: 520 }}>{dev.city}</strong>, where it’s {dev.time}.</span>
          <button type="button" onClick={() => choose(device)} className="rounded-pill bg-primary px-4 py-1.5 text-[13px] text-white hover:bg-primary-hover">Use {dev.city}</button>
        </div>
      ) : null}
      <div className="relative">
        <label htmlFor="tz-search" className="sr-only">Search for your city or time zone</label>
        <div className="flex items-center gap-2 rounded-pill bg-surface px-4 ring-1 ring-line focus-within:ring-primary">
          <Search className="size-4 text-slate" />
          <input
            id="tz-search"
            ref={input}
            role="combobox"
            aria-expanded={open}
            aria-controls="tz-list"
            aria-activedescendant={open && results[active] ? `tz-${active}` : undefined}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active].zone) }
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Change it: search a city, country or offset"
            className="h-11 flex-1 bg-transparent text-[15px] text-ink placeholder:text-slate focus:outline-none"
          />
        </div>
        {open ? (
          <ul id="tz-list" role="listbox" className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-[0_16px_40px_rgba(23,23,33,0.16)] ring-1 ring-line">
            {!q ? <li className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.06em] text-slate">Suggested</li> : null}
            {results.map((r, i) => (
              <li
                key={r.zone}
                id={`tz-${i}`}
                role="option"
                aria-selected={r.zone === saved}
                onMouseDown={(e) => { e.preventDefault(); choose(r.zone) }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', i === active ? 'bg-lavender' : '')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-ink">{r.city}{r.zone === device ? <span className="ml-2 text-[12px] text-primary">this device</span> : null}</span>
                  <span className="block truncate text-[12px] text-slate">{r.region}{r.name ? ` · ${r.name}` : ''}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] tabular text-ink">{r.time}</span>
                  <span className="block text-[11px] tabular text-slate">{r.offset}</span>
                </span>
                {r.zone === saved ? <Check className="size-4 shrink-0 text-primary" /> : <span className="w-4" />}
              </li>
            ))}
            {!results.length ? <li className="px-3 py-3 text-[14px] text-ink-2">No match. Try a nearby big city, or an offset like +5:30.</li> : null}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
