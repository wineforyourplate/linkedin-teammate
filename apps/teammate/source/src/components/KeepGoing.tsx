import { CastMascot } from '@/components/cast/CastMascot'
import { Button } from '@/components/ui'
import type { Queue } from '@/lib/session'

/* When a queue has more than today's share, you choose, like a photo app's review: keep
   going with the next batch, or leave the rest for tomorrow. Used in the 10 minutes,
   People and Engage. */

export const NOUN: Record<Queue, [string, string]> = { posts: ['post', 'posts'], replies: ['reply', 'replies'], people: ['person', 'people'], question: ['question', 'questions'] }
export const plural = (q: Queue, n: number) => `${n} ${NOUN[q][n === 1 ? 0 : 1]}`

export function KeepGoing({ queue, shown, more, onKeepGoing, onLeave }: { queue: Queue; shown: number; more: number; onKeepGoing: () => void; onLeave: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
      <CastMascot size={84} mood="happy" sleepAfter={0} quiet />
      <div>
        <h2 className="text-[22px] text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>That’s today’s {plural(queue, shown)}</h2>
        <p className="mt-1 text-[14.5px] text-ink-2">{more ? `${more} more ${NOUN[queue][more === 1 ? 0 : 1]} waiting.` : 'Nothing more waiting.'} Keep going, or leave {more === 1 ? 'it' : 'them'} for tomorrow.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {more ? <Button variant="primary" onClick={onKeepGoing}>Keep going</Button> : null}
        <Button onClick={onLeave}>{more ? 'Leave the rest for tomorrow' : 'Next'}</Button>
      </div>
    </div>
  )
}

