import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, MessageCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { NavIcon } from './NavIcon'
import { usePod } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { cn } from '@/lib/utils'
import { ChatPanel } from './ChatPanel'

export type View = 'today' | 'posts' | 'engage' | 'skills' | 'people' | 'you'

const NAV: { key: View; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'posts', label: 'Posts' },
  { key: 'engage', label: 'Engage' },
  { key: 'skills', label: 'Skills' },
  { key: 'people', label: 'People' },
  { key: 'you', label: 'You' },
]

export function useView(): [View, (v: View) => void] {
  const read = (): View => {
    const h = (location.hash || '').replace(/^#\/?/, '') as View
    return NAV.some((n) => n.key === h) ? h : 'today'
  }
  const [view, setView] = useState<View>(read)
  useEffect(() => {
    const on = () => setView(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [view, (v: View) => { location.hash = '/' + v; setView(v); window.scrollTo(0, 0) }]
}

export function Shell({ view, setView, children }: { view: View; setView: (v: View) => void; children: ReactNode }) {
  const { profile, drafts, people, messages, engagements } = usePod()
  const chat = useChat()
  const waiting =
    drafts.filter((d) => d.status === 'ready').length +
    people.filter((p) => p.stage === 'found').length +
    messages.filter((m) => m.status === 'draft').length
  const replies = engagements.filter((e) => (e.status === 'proposed' || e.status === 'liked') && e.comment_draft).length
  const badge = (k: View) => (k === 'today' ? waiting : k === 'engage' ? replies : 0)
  const signedIn = profile?.browser_status === 'signed_in'
  const name = profile?.first_name || profile?.linkedin_name?.split(' ')[0] || ''

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* the night rail */}
      <nav className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-night px-3 py-5 text-on-dark md:flex" aria-label="Main">
        <div className="mb-8 flex items-center gap-3 px-3">
          <span className="relative grid size-8 place-items-center">
            <span className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #c9d6f6, #9cb4e8 45%, #5266eb)' }} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px]" style={{ fontWeight: 480 }}>Growth teammate</p>
            {name ? <p className="truncate text-[12px] text-fog">for {name}</p> : null}
          </div>
        </div>
        <ul className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = view === n.key
            return (
              <li key={n.key}>
                <motion.button
                  type="button"
                  onClick={() => setView(n.key)}
                  aria-current={active ? 'page' : undefined}
                  initial={false}
                  animate={active ? 'active' : 'rest'}
                  whileHover="hover"
                  className={cn('flex h-10 w-full items-center gap-3 rounded-sm px-3 text-[15px] transition-colors', active ? 'bg-night-raised text-on-dark' : 'text-fog hover:bg-white/[0.04] hover:text-on-dark')}
                  style={{ fontWeight: active ? 460 : 400 }}
                >
                  <span className={cn('h-4 w-0.5 rounded-full', active ? 'bg-primary' : 'bg-transparent')} aria-hidden />
                  <NavIcon name={n.key} className="size-4" />
                  {n.label}
                  {badge(n.key) ? <span className="ml-auto rounded-pill bg-primary px-2 text-[12px] tabular text-white">{badge(n.key)}</span> : null}
                </motion.button>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto flex flex-col gap-2 px-3 text-[12px] text-fog">
          <span className="flex items-center gap-2">
            <span className={cn('size-1.5 rounded-full', signedIn ? 'bg-periwinkle' : 'border border-fog')} />
            {signedIn ? 'LinkedIn browser signed in' : 'Browser not signed in'}
          </span>
          {profile?.linkedin_api ? <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-periwinkle" />LinkedIn connection on</span> : null}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1">
        <main className="min-w-0 flex-1 px-5 pb-28 pt-8 sm:px-10 md:pb-12">{children}</main>
        <ChatPanel />
      </div>

      {/* phones: a bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/10 bg-night px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden" aria-label="Main">
        {NAV.map((n) => (
          <motion.button key={n.key} type="button" onClick={() => setView(n.key)} aria-current={view === n.key ? 'page' : undefined} initial={false} animate={view === n.key ? 'active' : 'rest'} whileHover="hover" className={cn('flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-sm text-[11px]', view === n.key ? 'text-on-dark' : 'text-fog')}>
            <NavIcon name={n.key} className="size-5" />
            {n.label}
          </motion.button>
        ))}
      </nav>
      {!chat.isOpen ? (
        <button type="button" onClick={chat.open} className="fixed bottom-24 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-pill bg-primary px-5 text-[15px] text-white shadow-[0_8px_24px_rgba(82,102,235,0.35)] md:bottom-6 xl:hidden" aria-label="Ask your teammate">
          <MessageCircle className="size-4" /> Ask
        </button>
      ) : null}
    </div>
  )
}

export function PageHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[34px] leading-[1.05] text-ink sm:text-[40px]" style={{ fontFamily: 'var(--font-display)', fontWeight: 520 }}>{title}</h1>
        {sub ? <p className="mt-2 text-[15px] text-ink-2">{sub}</p> : null}
      </div>
      {right}
    </header>
  )
}

export { CalendarDays }
