import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { usePod } from '@/lib/data'
import { Onboarding } from '@/onboarding/Onboarding'
import { CastMascot } from '@/components/cast/CastMascot'
import { Engage } from '@/views/Engage'
import { People } from '@/views/People'
import { Skills } from '@/views/Skills'
import { AppShell, useAppView } from './AppShell'
import { Home } from './Home'
import { Recommended } from './Recommended'
import { MyPosts } from './MyPosts'
import { Personalize } from './Personalize'
import { Composer, type ComposeStart } from './Composer'
import { TenMinutes, useTenMinutes } from './TenMinutes'

/* The app after onboarding: Home (your 10 minutes, with a finish line), Recommended (the
   teammate's suggestions) apart from Posts (your own work), Personalization, a full-screen
   composer for writing with Spool, and the 10-minute run itself. Only Home has a badge. */

export function App() {
  const pod = usePod()
  if (!pod.ready || !pod.profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-night text-fog">
        <div className="flex flex-col items-center gap-4">
          <CastMascot size={120} mood={pod.error ? 'worried' : 'working'} sleepAfter={0} quiet />
          {pod.error ? <p className="max-w-sm text-center text-[14px]">I couldn’t load your workspace: {pod.error}</p> : <p className="text-[14px]">One moment…</p>}
        </div>
      </div>
    )
  }
  if (pod.profile.onboarding_step !== 'done') return <Onboarding />
  return <Main />
}

function Main() {
  const [view, setView] = useAppView()
  const [composing, setComposing] = useState<ComposeStart | null>(null)
  const [session, setSession] = useState(false)
  const ten = useTenMinutes()
  // one badge: how many things are in today's 10 minutes
  const badges = { home: ten.count }
  return (
    <>
      <AppShell view={view} setView={setView} badges={badges}>
        {view === 'home' && <Home go={setView} compose={setComposing} startSession={() => setSession(true)} />}
        {view === 'recommended' && <Recommended compose={setComposing} />}
        {view === 'posts' && <MyPosts compose={setComposing} />}
        {view === 'engage' && <Engage />}
        {view === 'people' && <People />}
        {view === 'personal' && <Personalize go={setView} />}
        {view === 'skills' && <Skills />}
      </AppShell>
      <AnimatePresence>
        {session ? <TenMinutes key="ten" onClose={() => setSession(false)} compose={setComposing} /> : null}
      </AnimatePresence>
      <AnimatePresence>
        {composing ? <Composer key="composer" start={composing} onClose={() => setComposing(null)} onDone={() => { setComposing(null); if (!session) setView('posts') }} /> : null}
      </AnimatePresence>
    </>
  )
}
