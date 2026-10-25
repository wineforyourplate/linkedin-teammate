import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Globe, Linkedin, Minus, MoreHorizontal, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { usePod } from '@/lib/data'
import { cn } from '@/lib/utils'
import { NavIcon } from '@/components/NavIcon'
import { ChatPanel } from '@/components/ChatPanel'
import { CastMascot } from '@/components/cast/CastMascot'
import { Buddy } from '@/components/Buddy'
import { useLinkedInLink } from '@/lib/health'

/* The app's frame: a warm paper rail that collapses to icons, connection status as icons
   with labels on hover, and Spool in the bottom-right corner, where its suggestions live and
   where the chat opens from. Phones get a bottom bar with the four main places and "More". */

export type AppView = 'home' | 'recommended' | 'posts' | 'engage' | 'people' | 'personal' | 'skills'

export const NAV: { key: AppView; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'recommended', label: 'Recommended', icon: 'recommended' },
  { key: 'posts', label: 'Posts', icon: 'posts' },
  { key: 'engage', label: 'Engage', icon: 'engage' },
  { key: 'people', label: 'People', icon: 'people' },
  { key: 'personal', label: 'Personalization', icon: 'personal' },
  { key: 'skills', label: 'Skills', icon: 'zap' },
]
const PHONE: AppView[] = ['home', 'recommended', 'posts', 'engage']

export function useAppView(): [AppView, (v: AppView, anchor?: string) => void] {
  // Older links (#/today, #/you) land on their new homes.
  const LEGACY: Record<string, AppView> = { today: 'home', you: 'personal' }
  const read = (): AppView => {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('/')[0]
    const h = (LEGACY[raw] || raw) as AppView
    return NAV.some((n) => n.key === h) ? h : 'home'
  }
  const [view, setView] = useState<AppView>(read)
  useEffect(() => {
    const on = () => setView(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [view, (v: AppView, anchor?: string) => { location.hash = '/' + v + (anchor ? '/' + anchor : ''); setView(v); if (!anchor) window.scrollTo(0, 0) }]
}

function useCollapsed(): [boolean, (v: boolean) => void] {
  const [c, setC] = useState<boolean>(() => {
    try { return localStorage.getItem('nav.collapsed') === '1' } catch { return false }
  })
  return [c, (v: boolean) => { setC(v); try { localStorage.setItem('nav.collapsed', v ? '1' : '0') } catch { /* fine */ } }]
}

export function AppShell({ view, setView, badges = {}, children }: { view: AppView; setView: (v: AppView, anchor?: string) => void; badges?: Partial<Record<AppView, number>>; children: ReactNode }) {
  const { profile } = usePod()
  const [collapsed, setCollapsed] = useCollapsed()
  const [more, setMore] = useState(false)
  const signedIn = profile?.browser_status === 'signed_in'
  const link = useLinkedInLink()
  const liState = profile?.health?.linkedin?.state
  const broken = link === 'reauth' || (link === 'none' && !!profile?.linkedin_api) || (link === 'unknown' && (liState === 'reconnect' || liState === 'missing'))
  const linked = !broken && (link === 'connected' || !!profile?.linkedin_api)
  const browserBroken = profile?.browser_status === 'signed_out' || profile?.browser_status === 'checkpoint'
  const name = profile?.profile_confirmed ? profile?.first_name || profile?.linkedin_name?.split(' ')[0] : null
  // ⌘B / Ctrl+B folds the sidebar.
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); setCollapsed(!collapsed) } }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [collapsed, setCollapsed])
  const main = NAV.filter((n) => n.key !== 'skills')
  const skills = NAV.find((n) => n.key === 'skills')!

  return (
    <div className="flex min-h-screen bg-canvas">
      <motion.nav
        initial={false}
        animate={{ width: collapsed ? 76 : 244 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-line bg-rail py-4 text-ink md:flex"
        aria-label="Main"
      >
        <div className={cn('flex items-center gap-2 px-3', collapsed ? 'flex-col' : '')}>
          <CastMascot size={collapsed ? 48 : 52} sleepAfter={0} quiet className="-my-1 shrink-0" />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]" style={{ fontWeight: 520 }}>Spool</p>
              <p className="truncate text-[12px] text-slate">{name ? `${name}’s teammate` : 'Your teammate'}</p>
            </div>
          ) : null}
          <button type="button" onClick={() => setCollapsed(!collapsed)} className="grid size-9 shrink-0 place-items-center rounded-full text-slate hover:bg-ink/5 hover:text-ink" aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <ul className="mt-6 flex flex-col gap-1 px-3">
          {main.map((n) => {
            const active = view === n.key
            const badge = badges[n.key] || 0
            return (
              <li key={n.key}>
                <motion.button
                  type="button"
                  onClick={() => setView(n.key)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? `${n.label}${badge ? `, ${badge} waiting` : ''}` : undefined}
                  title={collapsed ? n.label : undefined}
                  initial={false}
                  animate={active ? 'active' : 'rest'}
                  whileHover="hover"
                  className={cn('relative flex h-10 w-full items-center gap-3 rounded-lg text-[15px] transition-colors', collapsed ? 'justify-center px-0' : 'px-3', active ? 'bg-surface text-ink shadow-[0_1px_0_var(--color-line),0_6px_16px_-10px_rgba(30,26,43,.3)]' : 'text-ink-2 hover:bg-ink/5 hover:text-ink')}
                  style={{ fontWeight: active ? 480 : 400 }}
                >
                  <NavIcon name={n.icon} className="size-[18px]" />
                  {!collapsed ? <span className="truncate">{n.label}</span> : null}
                  {badge ? (collapsed ? <span className="absolute right-3 top-2 size-2 rounded-full bg-primary" aria-hidden /> : <span className="ml-auto rounded-pill bg-primary px-2 text-[12px] tabular text-white">{badge}</span>) : null}
                </motion.button>
              </li>
            )
          })}
        </ul>

        <div className="mt-auto px-3">
          <motion.button
            type="button"
            onClick={() => setView('skills')}
            aria-current={view === 'skills' ? 'page' : undefined}
            title={collapsed ? 'Skills' : undefined}
            aria-label={collapsed ? 'Skills' : undefined}
            initial={false}
            animate={view === 'skills' ? 'active' : 'rest'}
            whileHover="hover"
            className={cn('mb-2 flex h-10 w-full items-center gap-3 rounded-lg text-[14px] transition-colors', collapsed ? 'justify-center' : 'px-3', view === 'skills' ? 'bg-surface text-ink shadow-[0_1px_0_var(--color-line)]' : 'text-ink-2 hover:bg-ink/5 hover:text-ink')}
          >
            <NavIcon name={skills.icon} className="size-[18px]" />
            {!collapsed ? 'Skills' : null}
          </motion.button>
        </div>
        <div className={cn('flex gap-1 px-3', collapsed ? 'flex-col items-center' : 'items-center')}>
          <StatusIcon on={signedIn} broken={browserBroken} label={signedIn ? 'LinkedIn browser: signed in' : profile?.browser_status === 'checkpoint' ? 'LinkedIn browser: LinkedIn wants to check it’s you' : 'LinkedIn browser: not signed in'} onClick={() => setView('personal', 'connections')}><Globe className="size-4" /></StatusIcon>
          <StatusIcon on={linked} broken={broken} label={broken ? 'LinkedIn connection: needs reconnecting' : linked ? 'LinkedIn connection: on' : 'LinkedIn connection: off'} onClick={() => setView('personal', 'connections')}><Linkedin className="size-4" /></StatusIcon>
        </div>
      </motion.nav>

      <div className="flex min-w-0 flex-1">
        <main className="min-w-0 flex-1 px-5 pb-[200px] pt-8 sm:px-10 md:pb-32">{children}</main>
        <ChatPanel docked={false} />
      </div>

      {/* phones: the four main places and More */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-canvas/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden" aria-label="Main">
        {PHONE.map((k) => {
          const n = NAV.find((x) => x.key === k)!
          return (
            <motion.button key={k} type="button" onClick={() => setView(k)} aria-current={view === k ? 'page' : undefined} initial={false} animate={view === k ? 'active' : 'rest'} whileHover="hover" className={cn('relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-[11px]', view === k ? 'text-ink' : 'text-slate')} style={{ fontWeight: view === k ? 560 : 400 }}>
              <NavIcon name={n.icon} className="size-5" />
              {n.label === 'Recommended' ? 'For you' : n.label}
              {badges[k] ? <span className="absolute right-[28%] top-1 size-2 rounded-full bg-primary" aria-hidden /> : null}
            </motion.button>
          )
        })}
        <button type="button" onClick={() => setMore(true)} className={cn('flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-[11px]', ['people', 'personal', 'skills'].includes(view) ? 'text-ink' : 'text-slate')}>
          <MoreHorizontal className="size-5" /> More
        </button>
      </nav>
      <AnimatePresence>
        {more ? (
          <motion.div className="fixed inset-0 z-40 flex items-end bg-[#171721]/50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-surface p-4 pb-[max(20px,env(safe-area-inset-bottom))] text-ink">
              <div className="mb-2 flex justify-end"><button type="button" onClick={() => setMore(false)} className="grid size-9 place-items-center rounded-full text-slate" aria-label="Close"><X className="size-4" /></button></div>
              {NAV.filter((n) => !PHONE.includes(n.key)).map((n) => (
                <button key={n.key} type="button" onClick={() => { setMore(false); setView(n.key) }} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-[16px] hover:bg-canvas">
                  <NavIcon name={n.icon} className="size-5" /> {n.label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Buddy go={setView} />
    </div>
  )
}

function StatusIcon({ on, broken, label, onClick, children }: { on: boolean; broken?: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="relative grid size-9 place-items-center rounded-full text-slate hover:bg-ink/5 hover:text-ink">
      {children}
      <span className={cn('absolute bottom-0.5 right-0.5 grid size-3.5 place-items-center rounded-full ring-2 ring-rail', broken ? 'bg-[#e8661f] text-white' : on ? 'bg-[#4ade80] text-ink' : 'bg-[#b9b4c7] text-white')} aria-hidden>
        {broken ? <span className="text-[9px] leading-none" style={{ fontWeight: 800 }}>!</span> : on ? <Check className="size-2.5" strokeWidth={3.5} /> : <Minus className="size-2.5" strokeWidth={3.5} />}
      </span>
    </button>
  )
}
