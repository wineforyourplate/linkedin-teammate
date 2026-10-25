import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { usePod } from '@/lib/data'
import { useChat, useChatContext } from '@/lib/chat'
import { skillInfo } from '@/lib/skills'
import { ago, fmtSlot, nextSlot, today } from '@/lib/time'
import type { Draft, Engagement } from '@/lib/types'
import { Button, Card, Eyebrow, Feed } from '@/components/ui'
import { PageHead, type View } from '@/components/Shell'
import { QuickQuestion, useQuickQueue } from './QuickQuestion'
import { WorkingOn } from './WorkingOn'
import { TodayChat } from './TodayChat'
import { VoiceImportCard } from './VoiceImport'
import { NeedsAccess, type AccessAsk } from '@/components/NeedsAccess'
import { talkThrough, whatToPost } from '@/lib/ideas'

export function useApprove() {
  const pod = usePod()
  return async (d: Draft) => {
    const p = pod.profile
    const taken = pod.drafts.filter((x) => x.status === 'approved' && x.scheduled_for).map((x) => x.scheduled_for as string)
    const at = d.scheduled_for && new Date(d.scheduled_for).getTime() > Date.now() + 10 * 60 * 1000 ? d.scheduled_for : nextSlot({ days: p?.posting_days, time: p?.posting_time, tz: p?.timezone, taken })
    await pod.update('drafts', d.id, { status: 'approved', approved_at: new Date().toISOString(), scheduled_for: at })
  }
}

function greeting(tz?: string | null) {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: tz || undefined }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function Today({ go }: { go: (v: View) => void }) {
  useChatContext('Today')
  const pod = usePod()
  const chat = useChat()
  const approve = useApprove()
  const { profile, drafts, people, messages, engagements, skills, recommendations, activity } = pod
  const tz = profile?.timezone

  const ready = drafts.filter((d) => d.status === 'ready')
  const ideas = drafts.filter((d) => d.status === 'idea').slice(0, 3)
  const replies = people.filter((p) => p.stage === 'replied')
  const toApprove = messages.filter((m) => m.status === 'draft')
  const found = people.filter((p) => p.stage === 'found').sort((a, b) => (b.score || 0) - (a.score || 0))
  const comments = engagements.filter((e) => (e.status === 'proposed' || e.status === 'liked') && e.comment_draft)
  const needsYou = skills.filter((s) => s.state === 'needs_you')
  const rec = recommendations.find((r) => r.status === 'new')
  const profileSkill = skills.find((s) => s.key === 'optimize_profile')
  const changes = ((profileSkill?.settings as { changes?: { part: string; next: string; why?: string; applied?: boolean; approved?: boolean }[] } | null)?.changes || [])
  const pendingChanges = changes.filter((c) => !c.applied && !c.approved)

  const since = Date.now() - 24 * 3600 * 1000
  const lastDay = activity.filter((a) => a.created_at && new Date(a.created_at).getTime() > since && a.skill !== 'learning')
  const live = activity.find((a) => a.created_at && Date.now() - new Date(a.created_at).getTime() < 20 * 60 * 1000 && a.skill !== 'learning')
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of lastDay) if (a.result !== 'skipped') c[a.action] = (c[a.action] || 0) + 1
    return c
  }, [lastDay])
  const name = profile?.profile_confirmed ? profile?.first_name || profile?.linkedin_name?.split(' ')[0] : null
  const quick = useQuickQueue()
  const [access, setAccess] = useState<AccessAsk | null>(null)
  const nothing = !quick.queue.length && !ready.length && !replies.length && !toApprove.length && !found.length && !comments.length && !needsYou.length && !rec && !pendingChanges.length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead
        title={greeting(tz) + (name ? `, ${name}` : '')}
        sub={live ? <span className="inline-flex items-center gap-2"><span className="size-1.5 animate-pulse rounded-full bg-primary" />{skillInfo(live.skill)?.name || 'Working'}: {live.detail}</span> : today(tz)}
      />

      <div className="flex flex-col gap-4">
        <TodayChat />
        <WorkingOn go={go} />
        <VoiceImportCard />
        <QuickQuestion q={quick} />

        {needsYou.map((s) => (
          <Card key={s.id} className="ring-[#f0c38f]">
            <Eyebrow className="text-[#8a4b00]">Needs you · {skillInfo(s.key)?.name}</Eyebrow>
            <p className="mt-2 text-[16px] text-ink">{s.status_text || 'This skill paused and needs you.'}</p>
            <div className="mt-4 flex gap-2">
              {profile?.browser_status !== 'signed_in' ? <Button variant="primary" onClick={() => setAccess({ title: `${skillInfo(s.key)?.name} works in your LinkedIn browser`, why: s.status_text || 'It reads and acts on LinkedIn in your own browser, at a human pace and inside safe limits.', access: 'browser' })}>Sign me in</Button> : null}
              <Button variant="ghost" onClick={() => void chat.send(`Why does ${skillInfo(s.key)?.name} need me?`)}>Why?</Button>
            </div>
          </Card>
        ))}

        {ready.map((d) => (
          <Card key={d.id}>
            <div className="flex items-center justify-between gap-3">
              <Eyebrow>Ready to approve · {d.format}</Eyebrow>
              <span className="text-[13px] text-slate tabular">{d.scheduled_for ? fmtSlot(d.scheduled_for, tz) : 'next free slot'}</span>
            </div>
            <PostPreview d={d} name={profile?.linkedin_name || profile?.display_name || 'You'} headline={profile?.headline} />
            {d.why_now ? <p className="mt-3 border-l-2 border-lavender pl-3 text-[14px] text-ink-2"><span className="text-ink" style={{ fontWeight: 480 }}>Why now: </span>{d.why_now}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void approve(d)}>Approve</Button>
              <Button onClick={() => go('posts')}>Edit</Button>
              <Button variant="ghost" onClick={() => void pod.update('drafts', d.id, { status: 'killed' })}>Not this one</Button>
            </div>
          </Card>
        ))}

        {ideas.length ? (
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>Ideas to talk through</Eyebrow>
              <button type="button" onClick={() => void whatToPost(chat.send)} className="text-[13px] text-primary hover:underline">Something else?</button>
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {ideas.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink" style={{ fontWeight: 460 }}>{d.title}</p>
                    {d.why_now ? <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-2">{d.why_now}</p> : null}
                  </div>
                  <Button size="sm" variant="tint" className="shrink-0" onClick={() => void talkThrough(chat.send, d)}>Talk it through</Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {replies.map((p) => (
          <Card key={p.id}>
            <Eyebrow>Waiting on you</Eyebrow>
            <p className="mt-2 text-[16px] text-ink"><span style={{ fontWeight: 480 }}>{p.name}</span> replied. {p.next_step}</p>
            <div className="mt-4 flex gap-2">
              {p.profile_url ? <a className="inline-flex h-10 items-center gap-2 rounded-pill bg-primary px-5 text-[15px] text-white" href="https://www.linkedin.com/messaging/" target="_blank" rel="noopener noreferrer">Open messages <ExternalLink className="size-4" /></a> : null}
              <Button variant="ghost" onClick={() => void chat.send(`Draft a reply to ${p.name} for me.`)}>Draft a reply</Button>
            </div>
          </Card>
        ))}

        {toApprove.map((m) => {
          const person = people.find((p) => p.id === m.person_id)
          return <MessageCard key={m.id} id={m.id} body={m.body} to={person?.name || 'someone'} kind={m.kind || 'first'} />
        })}

        {found.length ? (
          <Card>
            <Eyebrow>{found.length} {found.length === 1 ? 'person' : 'people'} worth knowing</Eyebrow>
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {found.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink" style={{ fontWeight: 460 }}>{p.name} <span className="text-slate" style={{ fontWeight: 380 }}>· {p.headline}</span></p>
                    <p className="mt-0.5 text-[14px] text-ink-2">{p.reason}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => void pod.update('people', p.id, { stage: 'approved' })} className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary/15" aria-label={`Approve ${p.name}`}><Check className="size-4" /></button>
                    <button type="button" onClick={() => void pod.update('people', p.id, { stage: 'skipped' })} className="grid size-9 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label={`Skip ${p.name}`}><X className="size-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
            {found.length > 5 ? <Button className="mt-3" variant="ghost" onClick={() => go('people')}>See all {found.length}</Button> : null}
          </Card>
        ) : null}

        {comments.length ? (
          <Card>
            <Eyebrow>Conversations worth joining</Eyebrow>
            <p className="mt-2 text-[16px] text-ink">{comments.length} {comments.length === 1 ? 'post' : 'posts'} from the last 12 hours on your topics, each with a reply ready.</p>
            <div className="mt-4"><Button variant="primary" onClick={() => go('engage')}>Open Engage</Button></div>
          </Card>
        ) : null}

        {pendingChanges.length && profileSkill ? (
          <Card>
            <Eyebrow>Your profile · {pendingChanges.length} change{pendingChanges.length > 1 ? 's' : ''} I’d make</Eyebrow>
            <p className="mt-3 text-[13px] text-slate">{pendingChanges[0].part}</p>
            <p className="mt-1 text-[16px] text-ink">{pendingChanges[0].next}</p>
            {pendingChanges[0].why ? <p className="mt-2 text-[14px] text-ink-2">{pendingChanges[0].why}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => go('skills')}>Review changes</Button>
            </div>
          </Card>
        ) : null}

        {rec ? (
          <Card tint>
            <Eyebrow>A suggestion</Eyebrow>
            <h2 className="mt-2 text-[22px] text-ink">{rec.title}</h2>
            <dl className="mt-4 grid gap-3 text-[15px] sm:grid-cols-[110px_1fr]">
              {rec.why ? (<><dt className="text-ink-2">Why</dt><dd className="text-ink">{rec.why}</dd></>) : null}
              {rec.plan ? (<><dt className="text-ink-2">What I’ll do</dt><dd className="text-ink">{rec.plan}</dd></>) : null}
              {rec.needs ? (<><dt className="text-ink-2">What I need</dt><dd className="text-ink">{rec.needs}</dd></>) : null}
              {rec.limits ? (<><dt className="text-ink-2">Limits</dt><dd className="text-ink">{rec.limits}</dd></>) : null}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  await pod.update('recommendations', rec.id, { status: 'accepted' })
                  const s = skills.find((x) => x.key === rec.skill_key)
                  if (s) await pod.update('skills', s.id, { state: 'on', started_at: s.started_at || new Date().toISOString() })
                  else void chat.send(`I accept your suggestion: ${rec.title}. What do you need from me?`)
                }}
              >
                {rec.kind === 'skill' ? 'Start' : 'Do it'}
              </Button>
              <Button onClick={() => void pod.update('recommendations', rec.id, { status: 'later', snooze_until: new Date(Date.now() + 7 * 86400000).toISOString() })}>Not now</Button>
              <Button variant="ghost" onClick={() => void chat.send(`Tell me more about this: ${rec.title}`)}>Tell me more</Button>
            </div>
          </Card>
        ) : null}

        {nothing ? (
          <Card className="text-center">
            <p className="text-[17px] text-ink">Nothing needs you right now.</p>
            <p className="mt-2 text-[14px] text-ink-2">New drafts and people arrive in the morning. Ask me for a post anytime.</p>
          </Card>
        ) : null}

        <section className="mt-6">
          <Eyebrow>The last 24 hours on your account</Eyebrow>
          <div className="mt-4">
            <Feed
              items={[
                counts.post ? { id: 'post', text: `${counts.post} post${counts.post > 1 ? 's' : ''} published` } : null,
                counts.like ? { id: 'like', text: `${counts.like} posts liked` } : null,
                counts.view_profile ? { id: 'vp', text: `${counts.view_profile} profiles viewed` } : null,
                counts.accept_invite ? { id: 'ai', text: `${counts.accept_invite} invitations accepted` } : null,
                counts.invite ? { id: 'inv', text: `${counts.invite} connection requests sent` } : null,
                counts.message ? { id: 'msg', text: `${counts.message} messages sent` } : null,
                counts.profile_edit ? { id: 'pe', text: `${counts.profile_edit} profile changes made` } : null,
              ].filter(Boolean) as { id: string; text: string }[]}
              empty="Nothing happened on your account yet."
            />
          </div>
        </section>

        <p className="py-8 text-center text-[16px] text-ink-2">That’s today.</p>
        <NeedsAccess ask={access} onReady={() => { const s = needsYou[0]; if (s) void pod.update('skills', s.id, { state: 'on' }) }} onClose={() => setAccess(null)} />
      </div>
    </div>
  )
}

export function PostPreview({ d, name, headline, photo, className }: { d: Draft; name: string; headline?: string | null; photo?: string | null; className?: string }) {
  const [open, setOpen] = useState(false)
  const body = d.body || d.title || ''
  const long = body.length > 420
  return (
    <article className={className ?? 'mt-4 rounded-md bg-canvas p-5 ring-1 ring-line'}>
      <div className="flex items-center gap-3">
        {photo ? <img src={photo} alt="" className="size-10 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="grid size-10 place-items-center rounded-full bg-lavender text-[15px] text-ink-2">{name.charAt(0)}</span>}
        <div className="min-w-0">
          <p className="truncate text-[14px] text-ink" style={{ fontWeight: 480 }}>{name}</p>
          {headline ? <p className="truncate text-[12px] text-slate">{headline}</p> : null}
        </div>
      </div>
      <p data-post-body className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink">{open || !long ? body : body.slice(0, 420) + '…'}</p>
      {long ? <button type="button" className="mt-1 text-[13px] text-primary" onClick={() => setOpen((v) => !v)}>{open ? 'less' : 'see more'}</button> : null}
      {d.format === 'carousel' ? <p className="mt-4 rounded-sm bg-lavender px-3 py-2 text-[13px] text-ink-2">Swipeable PDF carousel{(d.media || []).length ? ` · ${(d.media || []).length} slides` : ''}{d.pdf_path ? ' · ready' : ' · rendering'}</p> : null}
      {d.format === 'image' ? <p className="mt-4 rounded-sm bg-lavender px-3 py-2 text-[13px] text-ink-2">Image post · {(d.media || []).length || 1} image</p> : null}
      {d.format === 'poll' && d.poll ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[14px] text-ink">{d.poll.question}</p>
          {(d.poll.options || []).map((o) => <span key={o} className="rounded-pill px-4 py-2 text-[14px] text-ink ring-1 ring-line">{o}</span>)}
        </div>
      ) : null}
    </article>
  )
}

function MessageCard({ id, body, to, kind }: { id: string; body: string; to: string; kind: string }) {
  const pod = usePod()
  const [text, setText] = useState(body)
  const [editing, setEditing] = useState(false)
  return (
    <Card>
      <Eyebrow>{kind === 'followup' ? 'Follow-up' : kind === 'reply' ? 'Reply' : 'First message'} to {to}</Eyebrow>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-3 w-full rounded-md bg-canvas p-3 text-[15px] text-ink ring-1 ring-line focus:outline-none focus:ring-primary" aria-label="Message" />
      ) : (
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink">{body}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void pod.update('messages', id, { status: 'approved', body: text })}>{editing ? 'Save and approve' : 'Approve'}</Button>
        {!editing ? <Button onClick={() => setEditing(true)}>Edit</Button> : null}
        <Button variant="ghost" onClick={() => void pod.update('messages', id, { status: 'skipped' })}>Skip</Button>
      </div>
      <p className="mt-3 text-[12px] text-slate">I send approved messages in your browser, at a human pace, during your working hours.</p>
    </Card>
  )
}
