import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ExternalLink, Lock } from 'lucide-react'
import { useCurrentUser } from 'lemma-sdk/react'
import { lemmaClient } from '@/lemma-client'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { MORE_CONNECTORS, accountStatus, justConnected, linkedInMe, startConnect } from '@/lib/connect'
import { Button, Orb } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Actions, Card, Later, Primary, Title, useFlow, useMascot } from './flow'

type AccountState = 'connected' | 'reauth' | 'none'

/* "Connect your accounts", as a quick question in the app. The LinkedIn connection comes
   first: exact profile, and posting through LinkedIn itself. Then the honest part: LinkedIn
   keeps PDF carousels (and the rest of the in-app work) away from apps, so those need the
   person's own browser. Other connectors follow, all optional. */
export function ConnectAccounts({ onNext }: { onNext: (patch?: Record<string, unknown>) => void }) {
  const { profile, update } = usePod()
  const flow = useFlow()
  const { user } = useCurrentUser({ client: lemmaClient })
  const userId = (user as unknown as { id?: string } | null)?.id
  const [status, setStatus] = useState<Record<string, AccountState>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  const [starting, setStarting] = useState(false)
  // A working call beats the account's status flag (Lemma can mark an account for re-auth while it still answers).
  const [liWorks, setLiWorks] = useState(false)
  const liOn = (!!profile?.linkedin_api && status.linkedin !== 'reauth') || liWorks
  const signedIn = profile?.browser_status === 'signed_in'

  useEffect(() => {
    void accountStatus(userId, ['linkedin', ...MORE_CONNECTORS.map((c) => c.id)]).then(setStatus)
  }, [userId])

  // Back from connecting LinkedIn, or already connected: if it answers, record their LinkedIn id so posts can go through the API.
  const checked = useRef(false)
  useEffect(() => {
    if (!profile || checked.current) return
    checked.current = true
    justConnected('linkedin')
    if (profile.linkedin_api) return
    void linkedInMe().then((me) => {
      if (!me.connected || !me.urn) return
      setLiWorks(true)
      void update('profile', profile.id, { linkedin_urn: me.urn, linkedin_api: true, ...(profile.photo_url ? {} : { photo_url: me.photo_url }) })
    })
  }, [profile, update])

  const connect = async (id: string) => {
    setBusy(id)
    const err = await startConnect(id)
    if (err) setNote((n) => ({ ...n, [id]: err }))
    setBusy(null)
  }

  return (
    <>
      <Title sub="Everything works without these. Each one lets me do more on my own.">Connect your accounts</Title>
      <Card>
        <div className="flex items-start gap-4">
          <LinkedInMark />
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] text-ink" style={{ fontWeight: 560 }}>LinkedIn</p>
            <p className="mt-0.5 text-[14px] leading-snug text-ink-2">Your exact profile, and text, image and link posts go out through LinkedIn itself, even when you’re away.</p>
          </div>
          {liOn ? <Done text="Connected" /> : <Button variant="primary" size="sm" busy={busy === 'linkedin'} onClick={() => void connect('linkedin')}>{status.linkedin === 'reauth' ? 'Reconnect' : 'Connect'}</Button>}
        </div>
        {note.linkedin ? <p className="mt-3 text-[13px] text-[#8a4b00]">{note.linkedin}</p> : null}
      </Card>
      <Card>
        <p className="text-[15.5px] text-ink" style={{ fontWeight: 560 }}>Your LinkedIn browser</p>
        <p className="mt-0.5 text-[14px] leading-snug text-ink-2">LinkedIn doesn’t let apps post carousels, warm up your account or find people. For those I work in a private browser that’s yours alone, signed in by you.</p>
        <div className="mt-3">{signedIn ? <Done text="Signed in" /> : starting ? <BootSequence /> : <Button variant="tint" onClick={() => setStarting(true)}>Sign in</Button>}</div>
      </Card>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {MORE_CONNECTORS.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14.5px] text-ink" style={{ fontWeight: 520 }}>{c.name}</p>
              <p className="mt-0.5 text-[13px] text-ink-2">{note[c.id] || c.adds}</p>
            </div>
            {status[c.id] === 'connected' ? <Done text="Connected" /> : <Button variant="ghost" size="sm" busy={busy === c.id} onClick={() => void connect(c.id)}>{status[c.id] === 'reauth' ? 'Reconnect' : 'Connect'}</Button>}
          </li>
        ))}
      </ul>
      <Actions>
        <Primary onClick={() => (!liOn && !signedIn && flow.skip ? flow.skip() : onNext())}>{liOn || signedIn ? 'Done' : 'Continue without'}</Primary>
        <Later />
      </Actions>
    </>
  )
}

function Done({ text }: { text: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-mint px-3 py-1 text-[13px] text-[#1f6b45]">
      <Check className="size-3.5" strokeWidth={2.5} /> {text}
    </span>
  )
}

function LinkedInMark() {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-md bg-[#0a66c2] text-[17px] text-white" style={{ fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
      in
    </span>
  )
}

/* ---------- starting the browser ---------- */

const STAGES = ['Waking up your computer', 'Opening a private browser', 'Going to LinkedIn', 'Your turn: sign in']
const TARGET = [0.16, 0.42, 0.68, 0.9, 1]
const TIPS = [
  'Your password goes straight to LinkedIn. I never see it.',
  'This computer is yours alone. Nobody else’s teammate uses it.',
  'I start slowly: a handful of actions a day, building up over two weeks.',
  'You can sign me out any time, from Personalization, Connections.',
]

/** A Mac-style start-up while the person's cloud computer boots. Each stage lights up when it really happens. */
export function BootSequence() {
  const chat = useChat()
  const { profile } = usePod()
  const mascot = useMascot()
  const from = useRef(chat.blocks.length)
  const sent = useRef(false)
  const [now, setNow] = useState(Date.now())
  const [tip, setTip] = useState(0)
  const signedIn = profile?.browser_status === 'signed_in'
  useEffect(() => {
    if (sent.current || signedIn) return
    sent.current = true
    from.current = chat.blocks.length
    void chat.send('[onboarding] sign-in', { silent: true })
  }, [chat, signedIn])
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 400)
    const r = window.setInterval(() => setTip((i) => (i + 1) % TIPS.length), 5200)
    return () => {
      window.clearInterval(t)
      window.clearInterval(r)
    }
  }, [])
  useWaitFor(!signedIn, ['profile'], 4000, 600000)

  const fresh = chat.blocks.slice(from.current)
  const signin = [...fresh].reverse().find((b) => b.kind === 'signin')
  const steps = fresh.flatMap((b) => (b.kind === 'steps' ? b.steps : []))
  const touched = steps.some((s) => /browser|page|linkedin/i.test(s.text))
  const stage = signedIn ? 4 : signin ? 3 : touched ? 2 : steps.length ? 1 : 0
  const link = signin && signin.kind === 'signin' && !signin.done ? chat.signInLink(signin.toolCallId) : null

  // Spool works while the computer starts, looks away while you type your password, and cheers when you're in.
  const lastStage = useRef(-1)
  useEffect(() => {
    if (stage === lastStage.current) return
    lastStage.current = stage
    if (stage < 3) mascot.mood('working')
    else if (stage === 3) { mascot.mood('shy'); mascot.react('shy', 'Your turn. I’m not looking.', 2400) }
    else { mascot.mood('idle'); mascot.react('celebrate', 'You’re in!', 2000) }
  }, [stage, mascot])

  // Creep toward the next stage so the bar never looks stuck.
  const since = useRef({ stage, at: Date.now() })
  if (since.current.stage !== stage) since.current = { stage, at: Date.now() }
  const lo = TARGET[stage]
  const hi = TARGET[Math.min(stage + 1, 4)] - 0.03
  const pct = stage >= 4 ? 1 : Math.min(hi, lo + ((now - since.current.at) / 45000) * (hi - lo))

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 truncate rounded-pill bg-canvas px-3 py-1 text-[12px] text-slate">{stage >= 2 ? 'linkedin.com' : 'your private browser'}</span>
        </div>
        <div className="relative grid h-40 place-items-center bg-canvas/60 px-6">
          <AnimatePresence mode="wait">
            {stage === 3 && link ? (
              <motion.div key="link" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 text-center">
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-pill bg-primary px-6 text-[15px] text-white hover:bg-primary-hover">
                  Open my LinkedIn browser <ExternalLink className="size-4" />
                </a>
                <p className="text-[13px] text-ink-2">Sign in there, then come back. I’ll notice.</p>
              </motion.div>
            ) : stage === 4 ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-mint text-[#1f6b45]"><Check className="size-6" strokeWidth={2.5} /></span>
                <p className="text-[14px] text-ink">Signed in</p>
              </motion.div>
            ) : (
              <motion.div key="boot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                <Orb size={48} />
                <p className="text-[13px] text-ink-2">{STAGES[Math.min(stage, 3)]}…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="h-1 bg-ink/5">
          <motion.div className="h-full bg-ink" initial={false} animate={{ width: `${Math.round(pct * 100)}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {STAGES.map((s, i) => (
          <li key={s} className={cn('flex items-center gap-3 text-[14px] transition-colors', i < stage ? 'text-ink-2' : i === stage ? 'text-ink' : 'text-slate/70')}>
            <span className={cn('grid size-4 place-items-center rounded-full', i < stage ? 'bg-ink text-white' : i === stage ? 'ring-1 ring-ink' : 'ring-1 ring-ink/15')}>
              {i < stage ? <Check className="size-2.5" strokeWidth={3} /> : i === stage ? <span className="size-1.5 animate-pulse rounded-full bg-ink" /> : null}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <p className="flex min-h-[20px] items-start gap-2 text-[13px] text-ink-2">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        <AnimatePresence mode="wait">
          <motion.span key={tip} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}>
            {TIPS[tip]}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  )
}
