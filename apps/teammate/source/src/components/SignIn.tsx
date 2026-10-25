import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { Button } from '@/components/ui'

/** Start the LinkedIn sign-in in the person's own Lemma browser, from any day screen. */
export function useBrowserSignIn() {
  const chat = useChat()
  const { profile } = usePod()
  const [asked, setAsked] = useState(false)
  const signedIn = profile?.browser_status === 'signed_in'
  useWaitFor(asked && !signedIn, ['profile'], 4000, 600000)
  const block = [...chat.blocks].reverse().find((b) => b.kind === 'signin')
  const link = asked && block && block.kind === 'signin' && !block.done ? chat.signInLink(block.toolCallId) : null
  const start = () => {
    setAsked(true)
    void chat.send('[onboarding] sign-in', { silent: true })
  }
  return { signedIn, asked, link, start }
}

export function SignInInline({ label = 'Sign in to LinkedIn' }: { label?: string }) {
  const s = useBrowserSignIn()
  if (s.signedIn) return null
  if (s.link)
    return (
      <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-pill bg-primary px-5 text-[15px] text-white hover:bg-primary-hover">
        Open my LinkedIn browser <ExternalLink className="size-4" />
      </a>
    )
  return (
    <Button variant="primary" busy={s.asked} onClick={s.start}>
      {s.asked ? 'Starting your browser…' : label}
    </Button>
  )
}
