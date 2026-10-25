import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthGuard } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import { PodProvider, usePod } from './lib/data'
import { ChatProvider } from './lib/chat'
import { App } from './app/App'
import './styles.css'

const queryClient = new QueryClient()
// Dev-only: the onboarding lab (?lab), the screen preview (?preview=<step>) and proposals (?next). Never in the deployed bundle.
const Lab = import.meta.env.DEV && new URLSearchParams(location.search).has('lab') ? lazy(() => import('./lab/OnboardingLab').then((m) => ({ default: m.OnboardingLab }))) : null
const Preview = import.meta.env.DEV && new URLSearchParams(location.search).has('preview') ? lazy(() => import('./dev/Preview').then((m) => ({ default: m.Preview }))) : null
// Dev-only: proposals on real data (?next), shown before anything is built.
const Next = import.meta.env.DEV && new URLSearchParams(location.search).has('next') ? lazy(() => import('./dev/Next').then((m) => ({ default: m.Next }))) : null

function Chat({ children }: { children: React.ReactNode }) {
  const { refreshAll } = usePod()
  return <ChatProvider onTurnEnd={refreshAll}>{children}</ChatProvider>
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGuard client={lemmaClient}>
        {Lab ? (
          <Suspense fallback={null}>
            <Lab />
          </Suspense>
        ) : Preview ? (
          <Suspense fallback={null}>
            <Preview />
          </Suspense>
        ) : (
          <PodProvider>
            <Chat>
              {Next ? (
                <Suspense fallback={null}>
                  <Next />
                </Suspense>
              ) : (
                <App />
              )}
            </Chat>
          </PodProvider>
        )}
      </AuthGuard>
    </QueryClientProvider>
  </React.StrictMode>,
)
