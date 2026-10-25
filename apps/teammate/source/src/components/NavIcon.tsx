import { motion, useReducedMotion, type Variants } from 'motion/react'
import { CircleUserRound, LayoutGrid, MessagesSquare, Palette, PenLine, Sparkles, Sun, Users, Zap, type LucideIcon } from 'lucide-react'

/* Tab icons with a small personality each. They play on hover, and once when the
   tab becomes active. Still for anyone who prefers reduced motion. */

const ICONS: Record<string, { icon: LucideIcon; move: Variants['hover'] }> = {
  today: { icon: Sun, move: { rotate: [0, 90], scale: [1, 1.12, 1], transition: { duration: 0.6, ease: 'easeOut' } } },
  posts: { icon: PenLine, move: { rotate: [0, -14, 10, -6, 0], x: [0, 1, 0], transition: { duration: 0.55 } } },
  engage: { icon: MessagesSquare, move: { y: [0, -3, 0, -1.5, 0], transition: { duration: 0.55 } } },
  skills: { icon: Sparkles, move: { scale: [1, 1.25, 0.95, 1], rotate: [0, 12, 0], transition: { duration: 0.6 } } },
  people: { icon: Users, move: { x: [0, -2, 2, -1, 0], transition: { duration: 0.5 } } },
  you: { icon: CircleUserRound, move: { rotate: [0, -10, 8, 0], transition: { duration: 0.5 } } },
  home: { icon: LayoutGrid, move: { scale: [1, 0.82, 1.1, 1], transition: { duration: 0.45 } } },
  recommended: { icon: Sparkles, move: { scale: [1, 1.25, 0.95, 1], rotate: [0, 12, 0], transition: { duration: 0.6 } } },
  personal: { icon: Palette, move: { rotate: [0, -16, 12, 0], transition: { duration: 0.55 } } },
  zap: { icon: Zap, move: { y: [0, -2, 1, 0], rotate: [0, -12, 8, 0], transition: { duration: 0.45 } } },
}

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const calm = useReducedMotion()
  const spec = ICONS[name] ?? ICONS.today
  const Icon = spec.icon
  return (
    <motion.span className="inline-grid place-items-center" variants={calm ? undefined : { rest: { rotate: 0, x: 0, y: 0, scale: 1 }, hover: spec.move, active: spec.move }} aria-hidden>
      <Icon className={className} />
    </motion.span>
  )
}
