import { Avatar } from '@/views/Engage'
import { useEffect, useState } from 'react'
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
  { key: 'interested', label: 'Interested', match: (p: Person) => !!p.signal },
  { key: 'found', label: 'To approve', match: (p: Person) => p.stage === 'found' && !p.signal },
  { key: 'approved', label: 'Approved', match: (p: Person) => p.stage === 'approved' },
  { key: 'invited', label: 'Invited', match: (p: Person) => p.stage === 'invited' },
  { key: 'talking', label: 'Talking', match: (p: Person) => ['accepted', 'messaged', 'replied'].includes(p.stage) },
  { key: 'closed', label: 'Closed', match: (p: Person) => ['skipped', 'withdrawn'].includes(p.stage) },
] as const

export function People() {
  const pod = usePod()
  const chat = useChat()
  const hasInterest = pod.people.some((p) => !!p.signal)
  const [tab, setTab] = useState<(typeof STAGES)[number]['key']>(hasInterest ? 'interested' : 'found')
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

      {tab === 'interested' ? <Interested /> : null}

      {tab === 'interested' ? null : tab === 'found' && list.length ? <p className="mb-3 text-[14px] text-ink-2">Today’s {list.length === 1 ? 'one' : list.length}. Approve the ones you’d like to know; I write each a short note before anything is sent.</p> : null}

      {tab === 'interested' ? null : tab === 'found' && !list.length && q.people.more ? (
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

const SIGNAL: Record<string, { label: string; tone: 'on' | 'attention' | 'muted' }> = {
  hot: { label: 'Wants to try it', tone: 'attention' },
  question: { label: 'Asked a question', tone: 'on' },
  warm: { label: 'Replied twice', tone: 'muted' },
  big: { label: 'Big account', tone: 'muted' },
}
const RANK: Record<string, number> = { hot: 0, question: 1, big: 2, warm: 3 }

/** People who answered them and showed interest, newest and hottest first, each with the one DM or
    connection note the teammate drafted. Nothing is sent until they approve it here. */
function Interested() {
  const pod = usePod()
  const list = pod.people
    .filter((p) => !!p.signal)
    .sort((a, b) => (RANK[a.signal || ''] ?? 9) - (RANK[b.signal || ''] ?? 9) || new Date(b.signal_at || b.updated_at || 0).getTime() - new Date(a.signal_at || a.updated_at || 0).getTime())
  if (!list.length) {
    return (
      <Card className="text-center">
        <p className="text-[15px] text-ink-2">Nobody yet. When someone answers your comment with “I’ll take a look” or a question, I reply in the thread, put them here and draft a message for your OK.</p>
      </Card>
    )
  }
  return (
    <>
      <p className="mb-3 text-[14px] text-ink-2">People who answered you and might want more. I reply in the thread; the message is yours to approve.</p>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {list.map((p) => <InterestedRow key={p.id} p={p} />)}
        </ul>
      </Card>
    </>
  )
}

function InterestedRow({ p }: { p: Person }) {
  const pod = usePod()
  const msgs = pod.messages.filter((m) => m.person_id === p.id && (m.kind === 'dm' || m.kind === 'connect'))
  const draft = msgs.find((m) => m.status === 'draft' || m.status === 'failed')
  const done = msgs.find((m) => m.status === 'approved' || m.status === 'sent')
  const [text, setText] = useState(draft?.body || '')
  useEffect(() => setText(draft?.body || ''), [draft?.id, draft?.body])
  const s = SIGNAL[p.signal || ''] || SIGNAL.warm
  const save = () => draft && text !== draft.body && void pod.update('messages', draft.id, { body: text })
  return (
    <li className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink" style={{ fontWeight: 480 }}>
            {p.profile_url ? <a href={p.profile_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a> : p.name}
            {p.followers && p.followers >= 1e4 ? <span className="ml-2 text-[12.5px] text-slate" style={{ fontWeight: 400 }}>{Math.round(p.followers / 1e3)}K followers</span> : null}
          </p>
          {p.headline ? <p className="truncate text-[13px] text-slate">{p.headline}</p> : null}
        </div>
        <Status text={s.label} tone={s.tone} />
      </div>
      {p.said ? <p className="mt-3 border-l-2 border-lavender pl-3 text-[14px] leading-relaxed text-ink-2">“{p.said}”{p.thread_url ? <a href={p.thread_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-[12.5px] text-slate hover:text-ink">the thread <ExternalLink className="size-3" /></a> : null}</p> : null}
      {p.next_step ? <p className="mt-2 text-[13px] text-ink">Next: {p.next_step}</p> : null}
      {draft ? (
        <div className="mt-3">
          <label htmlFor={`m-${draft.id}`} className="block text-[12px] uppercase tracking-[0.06em] text-ink-2">{draft.kind === 'dm' ? 'Message' : 'Connection request note'}</label>
          {draft.why ? <p className="mt-1 text-[12.5px] text-slate">{draft.why}</p> : null}
          <textarea id={`m-${draft.id}`} value={text} onChange={(e) => setText(e.target.value)} onBlur={save} rows={Math.min(6, Math.max(3, Math.ceil(text.length / 70)))} maxLength={draft.kind === 'connect' ? 300 : undefined} className="mt-1.5 w-full rounded-md bg-lavender/60 p-3 text-[15px] leading-relaxed text-ink focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary" />
          {draft.error ? <p className="mt-1 text-[13px] text-[#8a4b00]">{draft.error}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" disabled={!text.trim()} onClick={() => void pod.update('messages', draft.id, { body: text, status: 'approved', error: null })}><Check className="size-3.5" /> {draft.kind === 'dm' ? 'Approve message' : 'Approve request'}</Button>
            <Button size="sm" variant="ghost" onClick={() => void pod.update('messages', draft.id, { status: 'skipped' })}><X className="size-3.5" /> Not this one</Button>
            <span className="ml-auto text-[12px] text-slate">I send it in your next LinkedIn session, at a human pace.</span>
          </div>
        </div>
      ) : done ? (
        <p className="mt-3 text-[13px] text-ink-2">{done.status === 'sent' ? `${done.kind === 'dm' ? 'Message' : 'Connection request'} sent ${done.sent_at ? ago(done.sent_at) : ''}.` : `${done.kind === 'dm' ? 'Message' : 'Connection request'} approved. It goes out in your next LinkedIn session.`}</p>
      ) : null}
      <p className="mt-2 text-[12px] text-slate">{p.signal_at ? `Showed interest ${ago(p.signal_at)}` : ''}</p>
    </li>
  )
}
