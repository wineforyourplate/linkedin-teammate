import { Avatar } from '@/views/Engage'
import { useState } from 'react'
import { Check, ExternalLink, X } from 'lucide-react'
import { usePod } from '@/lib/data'
import { useChat, useChatContext } from '@/lib/chat'
import { ago } from '@/lib/time'
import type { Person } from '@/lib/types'
import { Button, Card, Status } from '@/components/ui'
import { PageHead } from '@/components/Shell'
import { cn } from '@/lib/utils'
import { fromIST, useSessionQueues } from '@/lib/session'
import { KeepGoing } from '@/components/KeepGoing'

const STAGES = [
  { key: 'found', label: 'To approve', match: (p: Person) => p.stage === 'found' },
  { key: 'approved', label: 'Approved', match: (p: Person) => p.stage === 'approved' },
  { key: 'invited', label: 'Invited', match: (p: Person) => p.stage === 'invited' },
  { key: 'talking', label: 'Talking', match: (p: Person) => ['accepted', 'messaged', 'replied'].includes(p.stage) },
  { key: 'closed', label: 'Closed', match: (p: Person) => ['skipped', 'withdrawn'].includes(p.stage) },
] as const

export function People() {
  const pod = usePod()
  const chat = useChat()
  const [tab, setTab] = useState<(typeof STAGES)[number]['key']>('found')
  useChatContext(`People · ${tab}`)
  const q = useSessionQueues(null)
  const tz = pod.profile?.timezone
  // To approve: today's five (more if they keep going), like the 10 minutes
  const all = pod.people.filter(STAGES.find((s) => s.key === tab)!.match).sort((a, b) => (b.score || 0) - (a.score || 0))
  const list = tab === 'found' ? q.people.items : all
  const invited = pod.people.filter((p) => ['invited', 'accepted', 'messaged', 'replied'].includes(p.stage)).length
  const accepted = pod.people.filter((p) => ['accepted', 'messaged', 'replied'].includes(p.stage)).length
  const findOn = pod.skills.find((s) => s.key === 'find_people')?.state === 'on'

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead title="People" sub={invited ? `${accepted} of ${invited} invitations accepted` : 'Who’s worth knowing, and where each conversation stands'} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {STAGES.map((s) => {
          const n = s.key === 'found' ? q.people.items.length : pod.people.filter(s.match).length
          return (
            <button key={s.key} role="tab" aria-selected={tab === s.key} onClick={() => setTab(s.key)} className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-[14px] sm:px-4', tab === s.key ? 'border-primary text-ink' : 'border-transparent text-ink-2 hover:text-ink')} style={{ fontWeight: tab === s.key ? 480 : 400 }}>
              {s.label} {n ? <span className="text-slate tabular">{n}</span> : null}
            </button>
          )
        })}
      </div>

      {tab === 'found' && list.length ? <p className="mb-3 text-[14px] text-ink-2">Today’s {list.length === 1 ? 'one' : list.length}. Approve the ones you’d like to know; I write each a short note before anything is sent.</p> : null}

      {tab === 'found' && !list.length && q.people.more ? (
        <KeepGoing queue="people" shown={q.people.doneToday} more={q.people.more} onKeepGoing={() => q.choices.keepGoing('people')} onLeave={() => q.choices.leave('people')} />
      ) : !list.length ? (
        <Card className="text-center">
          <p className="text-[15px] text-ink-2">
            {tab === 'found' ? (q.people.rested && q.people.waiting ? `Done for today. ${q.people.waiting} more tomorrow.` : findOn ? `Nobody new to approve. I look again at ${fromIST('10:40', tz)} and ${fromIST('16:10', tz)}.` : 'Switch on “Find my people” in Skills and I’ll bring you a short list of people who fit.') : 'Nobody here yet.'}
          </p>
          {tab === 'found' && q.people.rested && q.people.waiting ? <Button className="mt-4" onClick={() => q.choices.keepGoing('people')}>Show them anyway</Button> : null}
          {tab === 'found' && !findOn ? <Button className="mt-4" onClick={() => void chat.send('Tell me what Find my people would do for me.')}>What would it do?</Button> : null}
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {list.map((p) => (
              <li key={p.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-ink" style={{ fontWeight: 480 }}>
                      {p.name}
                      {p.profile_url ? <a href={p.profile_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex text-slate hover:text-ink" aria-label={`Open ${p.name} on LinkedIn`}><ExternalLink className="size-3.5" /></a> : null}
                    </p>
                    {p.headline ? <p className="truncate text-[13px] text-slate">{p.headline}</p> : null}
                  </div>
                  {p.score != null ? <Status text={`${Math.round(p.score)}/10`} tone={p.score >= 7 ? 'on' : 'muted'} /> : null}
                </div>
                {p.reason ? <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{p.reason}</p> : null}
                {p.next_step ? <p className="mt-2 text-[13px] text-ink">Next: {p.next_step}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.stage === 'found' ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => void pod.update('people', p.id, { stage: 'approved' })} aria-label={`Approve ${p.name}`}><Check className="size-3.5" /> Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => void pod.update('people', p.id, { stage: 'skipped' })} aria-label={`Skip ${p.name}`}>Skip</Button>
                    </>
                  ) : null}
                  <span className="ml-auto text-[12px] text-slate">{p.source?.replace(/_/g, ' ')}{p.invited_at ? ` · invited ${ago(p.invited_at)}` : ''}{p.accepted_at ? ` · accepted ${ago(p.accepted_at)}` : ''}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {tab === 'found' && list.length && q.people.more ? <p className="mt-3 text-center text-[13px] text-slate">{q.people.more} more after these. You can keep going or leave them for tomorrow.</p> : null}
    </div>
  )
}
