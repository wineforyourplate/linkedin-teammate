import { MessageCircle, PenLine } from 'lucide-react'
import { usePod } from '@/lib/data'
import { useChat, useChatContext } from '@/lib/chat'
import { fmtSlot } from '@/lib/time'
import { Button, Card, Eyebrow } from '@/components/ui'
import { PageHead } from '@/components/Shell'
import { Topics } from '@/components/Topics'
import { PostPreview, useApprove } from '@/views/Today'
import type { ComposeStart } from './Composer'
import { LearnedLine, TeachChips } from '@/components/Teach'

/* Recommended: what Spool thinks you should post. Your topics on top (tags you can
   add, or talk through with Spool), then posts ready to approve, then ideas to write.
   Writing or editing any of them opens the full-screen composer. */

export function Recommended({ compose }: { compose: (s: ComposeStart) => void }) {
  useChatContext('Recommended')
  const pod = usePod()
  const chat = useChat()
  const approve = useApprove()
  const { drafts, profile } = pod
  const ready = drafts.filter((d) => d.status === 'ready')
  const ideas = drafts.filter((d) => d.status === 'idea')
  const tz = profile?.timezone
  const talkTopics = () => void chat.send('I want a new topic to post about. Ask me what I want to be known for, research what people are saying about it this month, and add it to my topics.', { fresh: true, context: 'Recommended · topics' })

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead title="Recommended" sub="What I’d post next, from your topics and this month’s conversation." />

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Your topics</Eyebrow>
          <Button size="sm" variant="tint" onClick={talkTopics}><MessageCircle className="size-4" /> Find a topic with me</Button>
        </div>
        <Topics />
      </section>

      {ready.length ? (
        <section className="mb-10">
          <Eyebrow>Ready to approve · {ready.length}</Eyebrow>
          <LearnedLine className="mt-2 text-[13px] text-ink-2" />
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {ready.map((d) => (
              <Card key={d.id} className="flex flex-col">
                <div className="flex items-center justify-between gap-2 text-[12.5px] text-slate">
                  <span className="rounded-pill bg-primary/8 px-2 py-0.5 text-ink-2">{d.format}</span>
                  <span className="tabular">{d.scheduled_for ? fmtSlot(d.scheduled_for, tz) : 'next free slot'}</span>
                </div>
                <PostPreview d={d} name={profile?.linkedin_name || profile?.display_name || 'You'} headline={profile?.headline} photo={profile?.photo_url} />
                {d.why_now ? <p className="mt-3 line-clamp-2 text-[13.5px] text-ink-2"><span className="text-ink" style={{ fontWeight: 480 }}>Why this one: </span>{d.why_now}</p> : null}
                <div className="mt-3"><TeachChips d={d} compose={compose} /></div>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button variant="primary" onClick={() => void approve(d)}>Approve</Button>
                  <Button onClick={() => compose({ draft: d })}>Work on it</Button>
                  <Button variant="ghost" onClick={() => void pod.update('drafts', d.id, { status: 'killed' })}>Not this one</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <Eyebrow>Ideas · {ideas.length}</Eyebrow>
        {ideas.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ideas.map((d) => (
              <Card key={d.id} className="flex flex-col gap-2">
                <p className="text-[17px] leading-snug text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{d.title}</p>
                {d.why_now ? <p className="line-clamp-2 text-[13.5px] text-ink-2">{d.why_now}</p> : null}
                <div className="mt-auto flex gap-2 pt-2">
                  <Button size="sm" variant="primary" onClick={() => compose({ idea: d })}><PenLine className="size-3.5" /> Write it</Button>
                  <Button size="sm" variant="ghost" onClick={() => void pod.update('drafts', d.id, { status: 'killed' })}>Not this</Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-3 text-center">
            <p className="text-[15px] text-ink">No ideas waiting. New ones arrive each morning from your topics.</p>
            <div className="mt-3 flex justify-center gap-2"><Button variant="primary" onClick={talkTopics}>Find a topic with me</Button><Button onClick={() => compose({})}>Write my own</Button></div>
          </Card>
        )}
      </section>
    </div>
  )
}
