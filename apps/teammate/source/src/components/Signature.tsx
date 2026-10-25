import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HoldButton } from '@/components/Press'
import { cn } from '@/lib/utils'

/** The working agreement, signed by holding: the signature draws itself as you hold, then a stamp lands. */
export function Signature({ night, sub, onDone, onHolding }: { night: boolean; sub: string; onDone: () => void; onHolding: (h: boolean) => void }) {
  const [p, setP] = useState(0)
  const [done, setDone] = useState(false)
  const holding = useRef(false)
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <svg viewBox="0 0 320 70" className="h-16 w-full max-w-sm" aria-hidden>
          <motion.path
            d="M8 48 C 22 18, 34 18, 38 40 S 52 62, 60 34 S 74 10, 82 38 Q 88 56, 98 40 T 120 36 C 132 30, 140 52, 152 44 S 170 22, 182 40 Q 190 52, 204 42 C 220 30, 236 50, 252 40 S 284 30, 310 36"
            fill="none"
            stroke={night ? '#EDEDF3' : '#1B1530'}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: done ? 1 : p, opacity: done || p > 0 ? 1 : 0 }}
            transition={{ duration: done ? 0.2 : 0 }}
          />
        </svg>
        <div className={cn('h-px w-full max-w-sm', night ? 'bg-white/25' : 'bg-[#1B1530]/25')} />
        <p className={cn('mt-1.5 text-[12px] uppercase tracking-[0.08em]', sub)}>Your signature</p>
        <AnimatePresence>
          {done ? (
            <motion.span
              initial={{ opacity: 0, scale: 2.4, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: -6 }}
              transition={{ type: 'spring', stiffness: 700, damping: 20 }}
              className="pointer-events-none absolute right-2 top-0 rounded-md border-[3px] border-[#8B74FF] px-4 py-1 text-[24px] uppercase tracking-[0.2em] text-[#8B74FF] sm:right-16"
              style={{ fontWeight: 700 }}
              aria-hidden
            >
              Deal
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <HoldButton
        tone={night ? 'primary' : 'dark'}
        ms={1400}
        onProgress={(v) => {
          setP(v)
          const h = v > 0 && v < 1
          if (h !== holding.current) { holding.current = h; onHolding(h) }
        }}
        onDone={() => { setDone(true); onDone() }}
        doneLabel={<>🤝 Signed.</>}
      >
        Press and hold to sign
      </HoldButton>
    </div>
  )
}

