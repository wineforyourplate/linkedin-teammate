import { usePod } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { usePendingIdentity } from '@/components/Identity'
import { cn } from '@/lib/utils'

/** A faint dot grid on the night background. It drifts while the teammate works and holds still while it waits on you. */
export function PixelGrid({ active, className }: { active: boolean; className?: string }) {
  return <div aria-hidden data-active={active} className={cn('pixel-grid pointer-events-none', className)} />
}

/** Is the teammate doing something right now (and not waiting on the person)? */
export function useTeammateBusy(): boolean {
  const { profile, facts } = usePod()
  const chat = useChat()
  const { looking } = usePendingIdentity()
  const waitingOnYou = chat.blocks.some((b) => b.kind === 'signin' && !b.done)
  const findingVoices = profile?.voice_mode === 'found' && !facts.some((f) => f.section === 'voice' && (f.kind === 'question' || f.source === 'you picked it'))
  return !waitingOnYou && (chat.running || looking || findingVoices || profile?.learning_status === 'running')
}
