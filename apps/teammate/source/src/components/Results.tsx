import { MessagesSquare, PenLine } from 'lucide-react'
import { usePod } from '@/lib/data'
import { fmtSlot } from '@/lib/time'
import { latestResult, vsUsual } from '@/lib/session'
import type { Draft } from '@/lib/types'
import { Button } from '@/components/ui'
import type { ComposeStart } from '@/app/Composer'
import { cn } from '@/lib/utils'

/* What a post did, a day and three days after it went out. People first (who reacted
   that matters), then the numbers, against their own usual once there are a few posts.
   "Write another like this" starts the next one; "This led to a conversation" teaches
   Spool what counts. */

export function ResultCard({ d, compose, className }: { d: Draft; compose: (s: ComposeStart) => void; className?: string }) {
  const pod = usePod()
  const r = latestResult(d)
  const x = vsUsual(d, pod.drafts)
  const tz = pod.profile?.timezone
  const when = d.results?.h72 ? 'three days on' : d.results?.h24 ? 'a day on' : null
  const first = (d.body || d.title || '').split('\n')[0].slice(0, 90)
  return (
    <article className={cn('flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 text-[15px] text-ink" style={{ fontWeight: 480 }}>
          {d.published_at ? `Your ${fmtSlot(d.published_at, tz).split(' ')[0]} post` : 'Your post'}{when ? `, ${when}` : ''}
        </p>
        {x != null ? <span className={cn('rounded-pill px-2.5 py-0.5 text-[12.5px]', x >= 1 ? 'bg-[#e8f5ee] text-[#1f7a4d]' : 'bg-[#f0f0f4] text-slate')}>{x}× your usual</span> : null}
      </div>
      <p className="line-clamp-1 text-[13.5px] text-ink-2">“{first}”</p>
      {r ? (
        <>
          {r.people?.length ? (
            <p className="text-[14px] text-ink"><span style={{ fontWeight: 520 }}>{r.people.length} {r.people.length === 1 ? 'person' : 'people'} worth knowing</span> reacted: {r.people.slice(0, 3).map((p) => p.name).join(', ')}{r.people.length > 3 ? '…' : ''}</p>
          ) : null}
          <div className="flex flex-wrap gap-5">
            {r.reactions != null ? <Stat n={r.reactions} label="reactions" /> : null}
            {r.comments != null ? <Stat n={r.comments} label="comments" /> : null}
            {r.reposts ? <Stat n={r.reposts} label="reposts" /> : null}
            {r.impressions != null ? <Stat n={r.impressions} label="impressions" /> : null}
            {r.profile_views ? <Stat n={r.profile_views} label="profile views" /> : null}
          </div>
          {r.why || r.try_next ? (
            <p className="rounded-xl bg-lavender px-3 py-2 text-[13.5px] text-ink-2">
              {r.why ? <><span className="text-ink" style={{ fontWeight: 480 }}>Why: </span>{r.why} </> : null}
              {r.try_next ? <><span className="text-ink" style={{ fontWeight: 480 }}>Try next: </span>{r.try_next}</> : null}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[13.5px] text-ink-2">I read its numbers a day after it goes out, and again after three days.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => compose({ seed: `Another post like the one that started “${first}”: ${r?.try_next || 'same kind of opening, a new story'}` })}><PenLine className="size-3.5" /> Write another like this</Button>
        <Button size="sm" variant={d.led_to_conversation ? 'tint' : 'ghost'} aria-pressed={!!d.led_to_conversation} onClick={() => void pod.update('drafts', d.id, { led_to_conversation: !d.led_to_conversation })}>
          <MessagesSquare className="size-3.5" /> {d.led_to_conversation ? 'Led to a conversation' : 'This led to a conversation'}
        </Button>
        {d.post_url ? <a href={d.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center px-3 text-[13px] text-primary hover:underline">Open the post</a> : null}
      </div>
    </article>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[22px] leading-none text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{n.toLocaleString()}</span>
      <span className="mt-1 text-[12px] text-ink-2">{label}</span>
    </span>
  )
}
