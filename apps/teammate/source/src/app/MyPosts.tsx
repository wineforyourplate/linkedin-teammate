import { useState } from 'react'
import { CalendarClock, PenLine } from 'lucide-react'
import { usePod } from '@/lib/data'
import { useChatContext } from '@/lib/chat'
import { fmtSlot } from '@/lib/time'
import type { Draft } from '@/lib/types'
import { Button, Card, Chip } from '@/components/ui'
import { PageHead } from '@/components/Shell'
import type { ComposeStart } from './Composer'
import { ResultCard } from '@/components/Results'

/* Your posts: what's coming up (only real posts, no empty calendar), what you're
   working on, and what went out. "New post" opens the full-screen composer. */

const TABS = [
  { key: 'drafts', label: 'Drafts', match: (d: Draft) => d.status === 'drafting' || d.status === 'ready' },
  { key: 'published', label: 'Published', match: (d: Draft) => d.status === 'published' },
  { key: 'failed', label: 'Didn’t go out', match: (d: Draft) => d.status === 'failed' },
] as const

export function MyPosts({ compose }: { compose: (s: ComposeStart) => void }) {
  useChatContext('Posts')
  const pod = usePod()
  const { drafts, profile } = pod
  const tz = profile?.timezone
  const anchor = location.hash.split('/')[2]
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(TABS.some((t) => t.key === anchor) ? (anchor as (typeof TABS)[number]['key']) : 'drafts')
  const coming = drafts.filter((d) => (d.status === 'approved' || d.status === 'publishing') && d.scheduled_for).sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime())
  const list = drafts.filter(TABS.find((t) => t.key === tab)!.match)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead title="Posts" sub={`${profile?.posts_per_week || 2} a week, around ${profile?.posting_time || '08:30'}`} right={<Button variant="primary" size="lg" onClick={() => compose({})}><PenLine className="size-4" /> New post</Button>} />

      <section className="mb-10">
        <p className="mb-3 flex items-center gap-2 text-[13px] text-ink-2"><CalendarClock className="size-4 text-primary" /> Coming up</p>
        {coming.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
            {coming.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => compose({ draft: d })} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-lavender/40">
                  <span className="w-28 shrink-0 rounded-xl bg-lavender px-3 py-2 text-center text-[13px] tabular text-ink" style={{ fontWeight: 480 }}>{fmtSlot(d.scheduled_for, tz)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink">{d.title || d.body?.slice(0, 80)}</span>
                    <span className="block text-[12.5px] text-slate">{d.format}{d.status === 'publishing' ? ' · going out now' : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-ink">Nothing scheduled yet.</p>
            <Button onClick={() => compose({})}>Write one</Button>
          </Card>
        )}
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => <Chip key={t.key} selected={tab === t.key} onClick={() => setTab(t.key)}>{t.label} · {drafts.filter(t.match).length}</Chip>)}
      </div>
      <div className="flex flex-col gap-3">
        {tab === 'published' ? list.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()).map((d) => <ResultCard key={d.id} d={d} compose={compose} />) : list.map((d) => (
          <Card key={d.id} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-ink" style={{ fontWeight: 470 }}>{d.title || d.body?.slice(0, 80) || 'Untitled'}</p>
              <p className="mt-1 line-clamp-2 text-[13.5px] text-ink-2">{d.body || d.why_now || ''}</p>
              <p className="mt-1 text-[12px] text-slate">{d.format}{d.published_at ? ` · published ${fmtSlot(d.published_at, tz)}` : ''}{d.error ? ` · ${d.error}` : ''}</p>
            </div>
            {d.post_url ? <a href={d.post_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[14px] text-primary hover:underline">Open</a> : <Button size="sm" onClick={() => compose({ draft: d })}>Open</Button>}
          </Card>
        ))}
        {!list.length ? <p className="py-6 text-center text-[14px] text-ink-2">{tab === 'published' ? 'Nothing out yet. Each post’s numbers show here a day after it goes out.' : tab === 'failed' ? 'Nothing failed. Good.' : 'No drafts. Recommended has ideas, or start one with New post.'}</p> : null}
      </div>
    </div>
  )
}
