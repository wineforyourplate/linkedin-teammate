import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { usePod } from '@/lib/data'
import type { Step } from '@/lib/types'
import { usePendingIdentity } from '@/components/Identity'
import { VoicePicker, useVoiceQuestion } from '@/components/VoicePicker'
import { Avatar } from '@/views/Engage'
import { ConnectAccounts } from '@/onboarding/Connect'
import { DestinationStep, Goals, Worries } from '@/onboarding/Onboarding'
import { Rhythm, Tone, Voice } from '@/onboarding/StartSteps'
import { FlowProvider, OPTIONAL, Title } from '@/onboarding/flow'

/* What onboarding left open comes back here, one small question at a time: confirm the
   profile found in the background, pick a voice, then each question they put off, in
   onboarding order. "Not now" hides it until tomorrow. */

const KEY = 'teammate.notNow'
/** The order questions come back in. */
const QUICK_ORDER: Step[] = ['dest', 'goals', 'tone', 'voice', 'worries', 'rhythm', 'browser']
const day = () => new Date().toISOString().slice(0, 10)
function readNotNow(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as { day: string; keys: string[] } | null
    return v && v.day === day() ? v.keys : []
  } catch {
    return []
  }
}
function writeNotNow(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: day(), keys }))
  } catch {
    /* fine: it shows again on reload */
  }
}

/** The open questions, in order, minus anything put off today. */
export function useQuickQueue() {
  const { profile: p } = usePod()
  const { pending } = usePendingIdentity()
  const voiceQ = useVoiceQuestion()
  const [notNow, setNotNow] = useState<string[]>(readNotNow)
  const skipped = ((p?.skipped || []) as Step[]).filter((s) => OPTIONAL.includes(s)).sort((a, b) => QUICK_ORDER.indexOf(a) - QUICK_ORDER.indexOf(b))
  const queue = [pending ? 'identity' : null, voiceQ ? 'voice-pick' : null, ...skipped].filter((k): k is string => !!k).filter((k) => !notNow.includes(k))
  const later = (k: string) => {
    const next = [...notNow, k]
    setNotNow(next)
    writeNotNow(next)
  }
  return { queue, later, voiceQ }
}

export function QuickQuestion({ q }: { q: ReturnType<typeof useQuickQueue> }) {
  const pod = usePod()
  const p = pod.profile
  const { queue, voiceQ } = q
  const first = queue[0]
  if (!p || !first) return null
  const later = () => q.later(first)
  const done = (patch: Record<string, unknown> = {}) => void pod.update('profile', p.id, { ...patch, skipped: (p.skipped || []).filter((s) => s !== first) })

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6" aria-label="A quick question">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="eyebrow text-slate">One quick question{queue.length > 1 ? ` · ${queue.length - 1} more after this` : ''}</p>
        {first === 'identity' || first === 'voice-pick' ? (
          <button type="button" onClick={later} className="rounded-pill px-3 py-1.5 text-[13px] text-ink-2 hover:bg-ink/5 hover:text-ink">Not now</button>
        ) : null}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={first} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4">
          <FlowProvider value={{ compact: true, skip: later, skipLabel: 'Not now' }}>
            {first === 'identity' && (
              <>
                <Title>Found you. Is this you?</Title>
                <div className="flex items-center gap-3">
                  <Avatar name={p.linkedin_name} photo={p.photo_url} size={48} />
                  <div className="min-w-0">
                    <p className="text-[15.5px] text-ink" style={{ fontWeight: 560 }}>{p.linkedin_name}</p>
                    {p.headline ? <p className="text-[13.5px] text-ink-2">{p.headline}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void pod.update('profile', p.id, { profile_confirmed: true, first_name: p.first_name || p.linkedin_name?.split(' ')[0] || null })} className="h-10 rounded-pill bg-primary px-5 text-[15px] text-on-primary">That’s me</button>
                  <button type="button" onClick={() => void pod.update('profile', p.id, { linkedin_name: null, headline: null, photo_url: null, linkedin_url: null })} className="h-10 rounded-pill px-4 text-[15px] text-ink-2 hover:bg-ink/5">Not me</button>
                </div>
              </>
            )}
            {first === 'voice-pick' && voiceQ ? (
              <>
                <Title sub="You asked me to find you a good voice. Here are three, each with a sample on your topic.">Pick a voice</Title>
                <VoicePicker q={voiceQ} dark={false} />
              </>
            ) : null}
            {first === 'dest' && <DestinationStep onNext={done} />}
            {first === 'goals' && <Goals onNext={done} />}
            {first === 'tone' && <Tone onNext={done} />}
            {first === 'voice' && <Voice onNext={done} />}
            {first === 'worries' && <Worries onNext={done} />}
            {first === 'rhythm' && <Rhythm onNext={done} />}
            {first === 'browser' && <ConnectAccounts onNext={done} />}
          </FlowProvider>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
