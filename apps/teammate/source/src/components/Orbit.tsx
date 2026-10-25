import { motion, useReducedMotion } from 'motion/react'
import type { WorldPerson } from '@/lib/types'
import { BUCKETS, firstName } from '@/lib/world'
import { Avatar } from '@/views/Engage'
import { cn } from '@/lib/utils'

/* Their world as an orbit: them in the middle, five rings of people around them (voices,
   decision-makers, news, builders, peers), a few faces per ring so names never collide.
   Decorative: the list beside it is what screen readers get. */

export function Orbit({ people, me, per = 3, className }: { people: WorldPerson[]; me?: { name?: string | null; photo?: string | null }; per?: 3 | 4; className?: string }) {
  const calm = useReducedMotion()
  const rank = (p: WorldPerson) => (p.photo ? 2 : 0) + (p.source === 'you' ? 1 : 0)
  const dots = BUCKETS.flatMap((b, bi) => {
    const mine = people.filter((p) => (p.bucket || 'voices') === b.key).sort((x, y) => rank(y) - rank(x) || (y.followers || 0) - (x.followers || 0)).slice(0, per)
    const centre = (bi / BUCKETS.length) * 2 * Math.PI - Math.PI / 2
    // three: one on the inner ring, two on the outer; four: two and two, staggered
    const spots = per === 3 ? [[0.3, 0], [0.45, -0.32], [0.45, 0.32]] : [[0.3, -0.3], [0.3, 0.3], [0.45, -0.42], [0.45, 0.42]]
    return mine.map((p, i) => {
      const [r, off] = spots[i]
      const a = centre + off
      return { p, bg: b.bg, left: 50 + r * 100 * Math.cos(a), top: 50 + r * 100 * Math.sin(a) }
    })
  })
  return (
    <div className={cn('relative mx-auto mb-3 aspect-square w-full', className)} aria-hidden>
      <div className="absolute inset-[20%] rounded-full border-[1.5px] border-dashed border-ink/12" />
      <div className="absolute inset-[5%] rounded-full border-[1.5px] border-dashed border-ink/12" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Avatar name={me?.name || 'You'} photo={me?.photo} size={64} />
      </div>
      {dots.map(({ p, bg, left, top }, i) => (
        <motion.div
          key={p.id}
          className="absolute flex w-[76px] flex-col items-center gap-0.5"
          style={{ left: `${left}%`, top: `${top}%`, x: '-50%', y: '-30%' }}
          initial={calm ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18, delay: calm ? 0 : Math.min(i, 20) * 0.05 }}
        >
          <span className="block rounded-full shadow-[0_6px_14px_-8px_rgba(30,26,43,.55)]"><Avatar name={p.name} photo={p.photo} size={38} tint={bg} /></span>
          <span className="max-w-full truncate rounded-pill bg-surface/90 px-1.5 text-[10.5px] leading-[1.5] text-ink" style={{ fontWeight: 560 }}>{firstName(p.name)}</span>
        </motion.div>
      ))}
    </div>
  )
}
