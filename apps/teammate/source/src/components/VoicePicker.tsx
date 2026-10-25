import { useState } from 'react'
import { Check } from 'lucide-react'
import { usePod } from '@/lib/data'
import type { Fact, VoiceOption } from '@/lib/types'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

/* When the person asked the teammate to "find me a good voice", it studies strong
   posts in their field and writes back three voices, each with a short sample on
   their topic, as one `facts` question whose options are those voices. */

const isVoice = (o: unknown): o is VoiceOption => !!o && typeof o === 'object' && typeof (o as VoiceOption).name === 'string'

/** The open "pick a voice" question, if the teammate has written one. */
export function useVoiceQuestion(): Fact | undefined {
  const { facts } = usePod()
  return facts.find((f) => f.kind === 'question' && f.section === 'voice' && (f.options || []).some(isVoice))
}

export function VoicePicker({ q, dark = true }: { q: Fact; dark?: boolean }) {
  const { update } = usePod()
  const voices = (q.options || []).filter(isVoice)
  const [picked, setPicked] = useState<string | null>(null)
  const choice = voices.find((v) => v.name === picked)
  const save = () => {
    if (!choice) return
    void update('facts', q.id, { kind: 'fact', label: 'Voice I write in', value: `${choice.name}: ${choice.how}`, locked: true, source: 'you picked it' })
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {voices.map((v) => {
          const on = v.name === picked
          return (
            <button
              key={v.name}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(v.name)}
              className={cn(
                'flex flex-col gap-2 rounded-lg p-4 text-left ring-1 transition-colors',
                dark ? (on ? 'bg-night-raised ring-periwinkle/70' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]') : on ? 'bg-lavender ring-primary' : 'bg-surface ring-line hover:bg-lavender/60',
              )}
            >
              <span className={cn('flex items-center justify-between gap-2 text-[15px]', dark ? 'text-on-dark' : 'text-ink')} style={{ fontWeight: 470 }}>
                {v.name}
                {on ? <Check className={cn('size-4', dark ? 'text-periwinkle' : 'text-primary')} /> : null}
              </span>
              <span className={cn('text-[13px] leading-snug', dark ? 'text-fog' : 'text-ink-2')}>{v.how}</span>
              {v.sample ? <span className={cn('mt-1 border-l-2 pl-3 text-[13px] italic leading-snug', dark ? 'border-white/15 text-on-dark/85' : 'border-line text-ink')}>{v.sample}</span> : null}
            </button>
          )
        })}
      </div>
      <div>
        <Button variant="primary" disabled={!choice} onClick={save}>
          {choice ? `Write as “${choice.name}”` : 'Pick one'}
        </Button>
      </div>
    </div>
  )
}
