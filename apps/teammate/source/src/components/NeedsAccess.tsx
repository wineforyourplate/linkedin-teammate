import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, Lock, X } from 'lucide-react'
import { useBrowserSignIn } from '@/components/SignIn'
import { startConnect } from '@/lib/connect'
import { usePod } from '@/lib/data'
import { Button } from '@/components/ui'

/* The "I can do that, but I need…" moment. Never a list of apps to connect up front:
   when someone asks for something that needs access, say what they asked for, why it
   needs it, what they get, how to give it, and the way round it. Once access lands,
   carry straight on with what they asked for (`onReady`). */

export type Access = 'browser' | 'linkedin'

export interface AccessAsk {
  /** What they asked for, as a heading: "To read your posts, I need to be signed in to LinkedIn". */
  title: string
  /** Why this needs it, in one or two sentences. */
  why: ReactNode
  access: Access
  /** The way round it, if there is one. */
  instead?: { label: string; run: () => void }
}

/** Is this access already there? */
export function useHasAccess(access: Access): boolean {
  const { profile } = usePod()
  return access === 'browser' ? profile?.browser_status === 'signed_in' : !!profile?.linkedin_api
}

export function NeedsAccess({ ask, onReady, onClose }: { ask: AccessAsk | null; onReady: () => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {ask ? (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171721]/50 p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ask.title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] text-ink shadow-[0_24px_60px_rgba(23,23,33,0.35)] sm:rounded-3xl"
          >
            <Body ask={ask} onReady={onReady} onClose={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function Body({ ask, onReady, onClose }: { ask: AccessAsk; onReady: () => void; onClose: () => void }) {
  const has = useHasAccess(ask.access)
  const signIn = useBrowserSignIn()
  const [note, setNote] = useState('')
  const fired = useRef(false)
  // The moment access lands, pick up exactly where they were.
  useEffect(() => {
    if (has && !fired.current) {
      fired.current = true
      onReady()
      onClose()
    }
  }, [has, onReady, onClose])

  const give = async () => {
    if (ask.access === 'browser') signIn.start()
    else {
      const e = await startConnect('linkedin')
      if (e) setNote(e)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender text-primary"><Lock className="size-4" /></span>
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label="Close"><X className="size-4" /></button>
      </div>
      <div>
        <h2 className="text-[22px] leading-snug text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.01em' }}>{ask.title}</h2>
        <div className="mt-2 text-[15px] leading-relaxed text-ink-2">{ask.why}</div>
      </div>
      {ask.access === 'browser' ? (
        <p className="flex items-start gap-2 rounded-xl bg-canvas p-3 text-[13px] text-ink-2 ring-1 ring-line">
          <Lock className="mt-0.5 size-3.5 shrink-0" /> It’s a private browser that’s yours alone. You sign in there yourself; I never see your password. I’ll carry on the moment you’re in.
        </p>
      ) : null}
      {note ? <p className="text-[13px] text-[#8a4b00]">{note}</p> : null}
      <div className="flex flex-col gap-2">
        {ask.access === 'browser' && signIn.link ? (
          <a href={signIn.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-pill bg-primary px-6 text-[16px] text-white hover:bg-primary-hover">
            Open my LinkedIn browser <ExternalLink className="size-4" />
          </a>
        ) : (
          <Button variant="primary" size="lg" busy={ask.access === 'browser' && signIn.asked} onClick={() => void give()}>
            {ask.access === 'browser' ? (signIn.asked ? 'Starting your browser…' : 'Sign me in to LinkedIn') : 'Connect LinkedIn'}
          </Button>
        )}
        {ask.instead ? (
          <Button size="lg" onClick={() => { onClose(); ask.instead?.run() }}>{ask.instead.label}</Button>
        ) : null}
        <Button variant="ghost" onClick={onClose}>Not now</Button>
      </div>
    </div>
  )
}
