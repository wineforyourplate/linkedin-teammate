import { useEffect, useState } from 'react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { joinWords } from '@/lib/skills'
import { BUCKETS, linkedInLink, nameFromLink, watching } from '@/lib/world'
import { Orbit } from '@/components/Orbit'
import { cn } from '@/lib/utils'
import { BootSequence } from './Connect'
import { Actions, Card, ChipField, Primary, Quiet, Spool, Title } from './flow'

/* The "your world" chapter: what they post about, who they never miss and where news breaks
   (topics, seeds, sources), an optional LinkedIn sign-in, then their world mapped live. The
   map runs in the background (10 to 20 minutes); nobody waits for it. */

type Patch = Record<string, unknown>

/** Start the first map and the first ideas, once each. */
export function useStartWork() {
  const pod = usePod()
  const chat = useChat()
  const p = pod.profile
  const once = (key: string, text: string) => {
    try {
      const at = Number(localStorage.getItem(key) || 0)
      if (Date.now() - at < 30 * 60 * 1000) return
      localStorage.setItem(key, String(Date.now()))
    } catch { /* fine: worst case it asks twice */ }
    void chat.task(text)
  }
  return {
    /** The first ideas need no browser, so they start as soon as the topics are settled. */
    ideas: () => {
      if (pod.drafts.some((d) => d.status === 'idea' && Date.now() - new Date(d.created_at || 0).getTime() < 86400e3)) return
      once('onb.ideas', '[onboarding] ideas')
    },
    /** The map. Returns the patch that marks it running. */
    map: (): Patch => {
      if (p?.world_status === 'mapping' || p?.world_status === 'done') return {}
      once('onb.world', '[onboarding] world')
      return { world_status: 'mapping' }
    },
  }
}

/* ---------- 5. Who's in your world ---------- */

export function WorldInputs({ onNext }: { onNext: (patch?: Patch) => void }) {
  const pod = usePod()
  const p = pod.profile
  const work = useStartWork()
  const topics = pod.topics.filter((t) => t.status !== 'paused')
  const seeds = pod.world.filter((w) => w.source === 'you' && w.status !== 'removed')
  const news = p?.news_sources || []
  const reading = !!p?.profile_confirmed && p.learning_status !== 'done' && p.learning_status !== 'failed'
  useWaitFor(reading && !topics.length, ['topics', 'profile'], 5000, 5 * 60 * 1000)
  const signedIn = p?.browser_status === 'signed_in'

  const addTopic = (name: string) => {
    if (topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) return
    void pod.create('topics', { name, source: 'you', status: 'active', research_status: 'idle', position: pod.topics.length })
  }
  const addSeed = (text: string) => {
    const url = linkedInLink(text)
    if (seeds.some((s) => (url && s.url === url) || s.name.toLowerCase() === text.toLowerCase())) return
    void pod.create('world', { name: url ? nameFromLink(url) : text, url, status: 'watching', source: 'you', bucket: 'voices', why: 'You never miss their posts', added_at: new Date().toISOString(), decided_at: new Date().toISOString() })
  }
  const setNews = (list: string[]) => p && void pod.update('profile', p.id, { news_sources: list })
  const go = () => {
    work.ideas()
    onNext(signedIn ? work.map() : {})
  }

  return (
    <>
      <Spool>{topics.length ? 'I drafted these from your headline and posts. Fix anything that’s off.' : reading ? 'I’m still reading your posts. Add what you post about and I’ll fill in the rest.' : 'Tell me what you post about. Three or four topics is plenty.'}</Spool>
      <Title>Who’s in your world?</Title>
      <Card className="flex flex-col gap-2.5">
        <p className="text-[14.5px] text-ink" style={{ fontWeight: 560 }}>Topics</p>
        <ChipField label="Add a topic" placeholder="+ add a topic" items={topics.map((t) => ({ key: t.id, text: t.name }))} onRemove={(id) => void pod.remove('topics', id)} onAdd={addTopic} />
      </Card>
      <Card className="flex flex-col gap-2.5">
        <div>
          <p className="text-[14.5px] text-ink" style={{ fontWeight: 560 }}>People whose posts you never miss <span className="text-[12.5px] text-slate" style={{ fontWeight: 400 }}>optional</span></p>
          <p className="mt-0.5 text-[13px] text-ink-2">I start from them and find the people around them.</p>
        </div>
        <ChipField label="Add a person" placeholder="A name or a LinkedIn link" tone="bg-sky" items={seeds.map((s) => ({ key: s.id, text: s.name }))} onRemove={(id) => void pod.remove('world', id)} onAdd={addSeed} />
      </Card>
      <Card className="flex flex-col gap-2.5">
        <div>
          <p className="text-[14.5px] text-ink" style={{ fontWeight: 560 }}>Where news in your field breaks <span className="text-[12.5px] text-slate" style={{ fontWeight: 400 }}>optional</span></p>
          <p className="mt-0.5 text-[13px] text-ink-2">Sites, newsletters or communities. What spikes there becomes ideas for you.</p>
        </div>
        <ChipField label="Add a news source" placeholder="+ a site, newsletter or community" tone="bg-butter" items={news.map((n) => ({ key: n, text: n }))} onRemove={(n) => setNews(news.filter((x) => x !== n))} onAdd={(n) => !news.includes(n) && setNews([...news, n])} />
      </Card>
      <Actions note={signedIn ? 'It takes 10 to 20 minutes. You won’t have to wait for it.' : undefined}>
        <Primary disabled={!topics.length && !seeds.length} onClick={go}>Find my people</Primary>
      </Actions>
    </>
  )
}

/* ---------- 6. Let me into LinkedIn (optional) ---------- */

export function SignInStep({ onNext }: { onNext: (patch?: Patch) => void }) {
  const pod = usePod()
  const work = useStartWork()
  const signedIn = pod.profile?.browser_status === 'signed_in'
  const [starting, setStarting] = useState(false)
  const go = () => onNext(work.map())
  return (
    <>
      <Spool>{signedIn ? 'You’re in. Now I can find your people inside LinkedIn, not just on the web.' : 'This one is optional, and you can do it later.'}</Spool>
      <Title sub="You sign in once, in a private browser that’s only yours. You type your password there; I never see it. Sign out any time.">Let me into LinkedIn</Title>
      {starting || signedIn ? (
        <BootSequence />
      ) : (
        <Card className="flex flex-col gap-3.5">
          {[
            ['📈', 'Your real numbers,', 'read every day, so we can see what works.'],
            ['🪐', 'Your people,', 'found inside LinkedIn, not just on the web.'],
            ['🗂️', 'Carousels,', 'which only go out this way.'],
          ].map(([e, b, t]) => (
            <div key={b} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-[17px]" aria-hidden>{e}</span>
              <p className="pt-1.5 text-[14.5px] leading-snug text-ink-2"><span className="text-ink" style={{ fontWeight: 560 }}>{b}</span> {t}</p>
            </div>
          ))}
        </Card>
      )}
      <Actions>
        {signedIn ? (
          <Primary onClick={go}>Find my people</Primary>
        ) : starting ? (
          <Quiet solo onClick={go}>Do it later</Quiet>
        ) : (
          <>
            <Primary onClick={() => setStarting(true)}>Sign in</Primary>
            <Quiet onClick={go}>Later</Quiet>
          </>
        )}
      </Actions>
    </>
  )
}

/* ---------- 7. Here's your world ---------- */

export function Reveal({ onNext }: { onNext: (patch?: Patch) => void }) {
  const pod = usePod()
  const p = pod.profile
  const work = useStartWork()
  const people = watching(pod.world)
  const seeds = people.filter((w) => w.source === 'you')
  const status = p?.world_status || 'idle'
  const done = status === 'done' || status === 'failed'
  const signedIn = p?.browser_status === 'signed_in'
  useWaitFor(!done, ['world', 'profile', 'activity'], 5000, 25 * 60 * 1000)

  // Arrived here without a map running (an older onboarding): start it now.
  useEffect(() => {
    if (status !== 'idle' || !p) return
    const patch = work.map()
    if (Object.keys(patch).length) void pod.update('profile', p.id, patch)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const line = status === 'failed'
    ? 'I couldn’t finish the map this time. I’ll pick it up on the next finding run.'
    : done
      ? 'Add or remove anyone in Your world, any time. I’ll suggest new people as I find them.'
      : seeds.length
        ? `I’m starting from ${joinWords(seeds.slice(0, 3).map((s) => s.name))} and the people around them.`
        : `Nobody to start from, so I’m searching your topics for people whose posts get real replies.${signedIn ? '' : ' Without your sign-in, it’s thinner.'}`
  return (
    <>
      <Spool>{line}</Spool>
      <Title>{done ? 'Here’s your world' : 'Mapping your world'}</Title>
      <Card className="flex flex-col items-center gap-4 py-5">
        <Orbit people={people} me={{ name: p?.linkedin_name, photo: p?.photo_url }} className="max-w-[340px]" />
        <p className="text-center text-[13.5px] text-ink-2" aria-live="polite">
          {people.length ? `${people.length} ${people.length === 1 ? 'person' : 'people'} so far, in five rings` : 'The first faces land in a minute or two.'}
        </p>
        <ul className="flex flex-wrap justify-center gap-1.5">
          {BUCKETS.map((b) => {
            const n = people.filter((w) => (w.bucket || 'voices') === b.key).length
            return (
              <li key={b.key} className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12.5px] text-ink transition-opacity', !n && 'opacity-45')} style={{ background: b.bg }}>
                <span aria-hidden>{b.emoji}</span>{b.label}<span className="tabular text-ink-2">{n}</span>
              </li>
            )
          })}
        </ul>
      </Card>
      <Actions note={done ? undefined : 'This takes 10 to 20 minutes. Carry on; I’ll finish in the background.'}>
        <Primary onClick={() => onNext()}>{done ? 'Keep these' : 'Keep going'}</Primary>
      </Actions>
    </>
  )
}
