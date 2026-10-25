import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, Plus, X } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import type { WorldPerson } from '@/lib/types'
import { BUCKETS, SOFT_SIZE, SOURCE, fmtCount, joinedThisWeek, linkedInLink, nameFromLink, sameLink, suggested, watching } from '@/lib/world'
import { Button } from '@/components/ui'
import { Orbit } from '@/components/Orbit'
import { Avatar } from '@/views/Engage'
import { ChipField } from '@/onboarding/flow'
import { cn } from '@/lib/utils'

/* Your world: the people whose posts Spool watches for you, in five rings. Suggestions sit on
   top (people who talked to you, kept showing up, or LinkedIn puts next to your people), and
   nobody joins until you press Add. On a wide screen the orbit sits beside the list; on a
   phone they stack. */

const now = () => new Date().toISOString()

export function WorldPage() {
  const pod = usePod()
  const p = pod.profile
  const chat = useChat()
  const people = watching(pod.world)
  const sugg = suggested(pod.world).sort((a, b) => (b.seen_count || 0) - (a.seen_count || 0))
  const removed = pod.world.filter((w) => w.status === 'removed')
  const joined = joinedThisWeek(pod.world).length
  const mapping = p?.world_status === 'mapping'
  useWaitFor(mapping, ['world', 'profile'], 6000, 25 * 60 * 1000)

  const add = (w: WorldPerson) => pod.update('world', w.id, { status: 'watching', removed_reason: null, decided_at: now(), added_at: w.added_at || now() })
  const pass = (w: WorldPerson) => pod.update('world', w.id, { status: 'removed', removed_reason: 'not_now', decided_at: now() })
  const remove = (w: WorldPerson) => pod.update('world', w.id, { status: 'removed', removed_reason: 'you', decided_at: now() })
  const map = () => {
    if (!p) return
    void pod.update('profile', p.id, { world_status: 'mapping' })
    void chat.task('[world] map')
  }

  return (
    <div className="flex flex-col gap-5 @container">
      {sugg.length ? <Suggestions list={sugg} add={add} pass={pass} /> : null}
      <div className="grid gap-5 @2xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] @2xl:items-start">
        {/* phones: orbit, then the list, then news (the wrapper dissolves); wide: orbit and news beside the list */}
        <div className="contents @2xl:sticky @2xl:top-8 @2xl:flex @2xl:flex-col @2xl:gap-4">
          <section className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-4 py-5 ring-1 ring-line" aria-label="Your world at a glance">
            <Orbit people={people} me={{ name: p?.linkedin_name, photo: p?.photo_url }} className="max-w-[300px]" />
            <div className="text-center" aria-live="polite">
              <p className="text-[15px] text-ink-2"><span className="mr-1.5 text-[28px] leading-none tabular text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 560 }}>{people.length}</span>{people.length === 1 ? 'person' : 'people'} you watch</p>
              <p className="mt-1 text-[13px] text-slate">
                {mapping ? 'Still mapping: more faces land as I find them.' : [joined ? `${joined} joined this week` : people.length ? 'Nobody new this week' : null, people.length ? 'a few faces per ring' : null].filter(Boolean).join(' · ') || 'Nobody here yet.'}
              </p>
              {people.length > SOFT_SIZE ? <p className="mx-auto mt-2 max-w-[280px] rounded-xl bg-peach px-3 py-2 text-[12.5px] leading-snug text-ink">That’s past {SOFT_SIZE}, where a world gets hard to keep up with. Your weekly review names the quietest people to let go.</p> : null}
            </div>
            {!people.length && !mapping ? <Button variant="primary" onClick={map}>Map my world</Button> : null}
          </section>
          <div className="order-last @2xl:order-none"><News /></div>
        </div>
        <section className="flex min-w-0 flex-col gap-4" aria-label="Everyone in your world">
          <AddByLink />
          {BUCKETS.map((b) => <Ring key={b.key} bucket={b} people={people.filter((w) => (w.bucket || 'voices') === b.key)} remove={remove} />)}
          {removed.length ? <Removed list={removed} add={add} /> : null}
        </section>
      </div>
    </div>
  )
}

/** People Spool would add, each with the reason. Add or Not now; nothing joins on its own. */
function Suggestions({ list, add, pass }: { list: WorldPerson[]; add: (w: WorldPerson) => Promise<void>; pass: (w: WorldPerson) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const addAll = async () => {
    setBusy(true)
    for (const w of list) await add(w)
    setBusy(false)
  }
  return (
    <section className="rounded-2xl bg-butter/70 p-4 ring-1 ring-[#f1e3ad] sm:p-5" aria-labelledby="sugg-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="sugg-h" className="text-[17px] text-ink" style={{ fontWeight: 560 }}>{list.length === 1 ? 'One person to add?' : `${list.length} people to add?`}</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-2">From your last finding runs. Nobody joins your world until you say so.</p>
        </div>
        {list.length > 1 ? <Button size="sm" variant="primary" busy={busy} onClick={() => void addAll()}>Add all {list.length}</Button> : null}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {list.map((w) => (
            <motion.li key={w.id} layout exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-line">
              <Avatar name={w.name} photo={w.photo} size={40} />
              <div className="min-w-0 flex-1 basis-[180px]">
                <p className="flex flex-wrap items-baseline gap-x-2 text-[14.5px] text-ink" style={{ fontWeight: 540 }}>
                  <PersonLink w={w} />
                  {w.source && SOURCE[w.source] ? <span className="rounded-pill bg-canvas px-2 py-0.5 text-[11.5px] text-ink-2" style={{ fontWeight: 500 }}>{SOURCE[w.source]}</span> : null}
                </p>
                {w.why ? <p className="text-[13px] leading-snug text-ink-2">{w.why}</p> : w.headline ? <p className="truncate text-[13px] text-ink-2">{w.headline}</p> : null}
              </div>
              <div className="ml-auto flex shrink-0 gap-1.5">
                <Button size="sm" variant="primary" onClick={() => void add(w)} aria-label={`Add ${w.name} to your world`}><Plus className="size-3.5" /> Add</Button>
                <Button size="sm" variant="ghost" onClick={() => void pass(w)} aria-label={`Not now for ${w.name}`}>Not now</Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  )
}

function PersonLink({ w }: { w: WorldPerson }) {
  return w.url ? (
    <a href={w.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline">{w.name}</a>
  ) : <span className="min-w-0 truncate">{w.name}</span>
}

/** Paste a profile or company link and they're in, as yours. Spool fills in the rest. */
function AddByLink() {
  const pod = usePod()
  const chat = useChat()
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const link = linkedInLink(url)
    if (!link) return setNote('That doesn’t look like a LinkedIn profile or company link.')
    setNote('')
    const known = pod.world.find((w) => sameLink(w.url, link))
    setBusy(true)
    if (known) {
      if (known.status !== 'watching') await pod.update('world', known.id, { status: 'watching', removed_reason: null, decided_at: now() })
      setNote(known.status === 'watching' ? `${known.name} is already in your world.` : `${known.name} is back in your world.`)
    } else {
      const row = (await pod.create('world', { name: nameFromLink(link), url: link, status: 'watching', source: 'you', bucket: 'voices', why: 'You added them', added_at: now(), decided_at: now() })) as { id?: string; data?: { id?: string } } | null
      const id = row?.id || row?.data?.id
      if (id) void chat.task(`[world] add ${id}`)
      setNote('Added. I’ll fill in their name, photo and ring in a minute.')
    }
    setBusy(false)
    setUrl('')
  }
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex gap-2">
        <label htmlFor="world-add" className="sr-only">Add someone by their LinkedIn link</label>
        <input id="world-add" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a LinkedIn link" inputMode="url" autoCapitalize="none" autoCorrect="off" className="h-11 min-w-0 flex-1 rounded-pill bg-surface px-4 text-[15px] text-ink ring-1 ring-line placeholder:text-slate focus:outline-none focus:ring-ink" />
        <Button variant="primary" type="submit" busy={busy} disabled={!url.trim()} className="h-11">Add</Button>
      </form>
      {note ? <p className="mt-1.5 px-1 text-[13px] text-ink-2" aria-live="polite">{note}</p> : null}
    </div>
  )
}

/** One ring: its people, a few at first on long lists. */
function Ring({ bucket, people, remove }: { bucket: (typeof BUCKETS)[number]; people: WorldPerson[]; remove: (w: WorldPerson) => Promise<void> }) {
  const [all, setAll] = useState(false)
  if (!people.length) return null
  const sorted = [...people].sort((a, b) => Number(b.source === 'you') - Number(a.source === 'you') || (b.followers || 0) - (a.followers || 0))
  const shown = all ? sorted : sorted.slice(0, 6)
  return (
    <section aria-label={bucket.label}>
      <h3 className="flex flex-wrap items-baseline gap-x-2 px-1 text-[14px] text-ink" style={{ fontWeight: 560 }}>
        <span className="inline-flex items-center gap-1.5"><span className="grid size-6 place-items-center rounded-full text-[13px]" style={{ background: bucket.bg }} aria-hidden>{bucket.emoji}</span>{bucket.label}</span>
        <span className="tabular text-ink-2" style={{ fontWeight: 400 }}>{people.length}</span>
        <span className="text-[12.5px] text-slate" style={{ fontWeight: 400 }}>{bucket.why}</span>
      </h3>
      <ul className="mt-2 flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {shown.map((w) => (
          <li key={w.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <Avatar name={w.name} photo={w.photo} size={36} tint={bucket.bg} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[14.5px] text-ink" style={{ fontWeight: 520 }}>
                <PersonLink w={w} />
                {w.url ? <ExternalLink className="size-3 shrink-0 text-slate" aria-hidden /> : null}
              </p>
              {w.why ? <p className="truncate text-[12.5px] text-ink-2">{w.why}</p> : null}
              {w.followers || w.cadence ? <p className="text-[12px] text-slate">{[w.followers ? `${fmtCount(w.followers)} followers` : null, w.cadence ? `posts ${w.cadence}` : null].filter(Boolean).join(' · ')}</p> : null}
            </div>
            <button type="button" onClick={() => void remove(w)} aria-label={`Remove ${w.name} from your world`} title="Remove" className="grid size-9 shrink-0 place-items-center rounded-full text-slate hover:bg-ink/5 hover:text-ink"><X className="size-4" /></button>
          </li>
        ))}
      </ul>
      {sorted.length > 6 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1.5 px-1 text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">{all ? 'Show fewer' : `Show all ${sorted.length}`}</button>
      ) : null}
    </section>
  )
}

/** People who left the world: dropped for going quiet, or removed. One tap brings them back. */
function Removed({ list, add }: { list: WorldPerson[]; add: (w: WorldPerson) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const why = (w: WorldPerson) => (w.removed_reason === 'inactive' ? 'Quiet for 30 days' : w.removed_reason === 'not_now' ? 'You passed' : w.removed_reason === 'expired' ? 'Suggested, not answered in 2 weeks' : 'You removed them')
  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="px-1 text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">{open ? 'Hide' : 'Show'} people who left ({list.length})</button>
      {open ? (
        <ul className="mt-2 flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {list.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-3 py-2 sm:px-4">
              <Avatar name={w.name} photo={w.photo} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink-2"><PersonLink w={w} /></p>
                <p className="text-[12px] text-slate">{why(w)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void add(w)}>Add back</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** Where news in their field breaks: what spikes there turns into ideas. */
function News() {
  const pod = usePod()
  const p = pod.profile
  const news = p?.news_sources || []
  const set = (list: string[]) => p && void pod.update('profile', p.id, { news_sources: list })
  return (
    <section className={cn('rounded-2xl bg-surface p-4 ring-1 ring-line')} aria-labelledby="news-h">
      <h3 id="news-h" className="text-[14.5px] text-ink" style={{ fontWeight: 560 }}>Where news in your field breaks</h3>
      <p className="mb-3 mt-0.5 text-[13px] text-ink-2">Sites, newsletters or communities. What spikes there becomes ideas.</p>
      <ChipField label="Add a news source" placeholder="+ a site or newsletter" tone="bg-butter" items={news.map((n) => ({ key: n, text: n }))} onRemove={(n) => set(news.filter((x) => x !== n))} onAdd={(n) => !news.includes(n) && set([...news, n])} />
    </section>
  )
}
