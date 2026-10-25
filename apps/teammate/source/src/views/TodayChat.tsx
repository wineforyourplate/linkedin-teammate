import { motion } from 'motion/react'
import { usePod } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { PixelGrid } from '@/components/PixelGrid'

/* Today's conversation: four fixed ways into a post, each opening a fresh chat with
   the teammate. One of them reads the topic with the freshest research. */

export function TodayChat() {
  const { topics } = usePod()
  const chat = useChat()
  const fresh = topics
    .filter((t) => t.status !== 'paused' && (t.signals?.working?.length || t.signals?.asking?.length))
    .sort((a, b) => new Date(b.researched_at || 0).getTime() - new Date(a.researched_at || 0).getTime())[0]
  const prompts = [
    { emoji: '💡', label: 'Something happened at work', text: 'Something happened at work that might be worth a post. Ask me what it was.' },
    fresh
      ? { emoji: '📰', label: `What’s new in ${fresh.name}`, text: `What’s new in “${fresh.name}” this month? Give me the two most interesting signals and ask which one I want to react to.`, ctx: `Topic ${fresh.id}` }
      : { emoji: '📰', label: 'What’s new in my topics', text: 'What’s new in my topics this month? Give me the two most interesting things and ask which one I want to react to.' },
    { emoji: '🎙️', label: 'Interview me', text: 'I don’t know what to post today. Interview me, one question at a time.' },
    { emoji: '✍️', label: 'I have an idea', text: 'I have an idea for a post. Help me shape it.' },
  ]
  return (
    <section className="relative isolate overflow-hidden rounded-xl bg-night p-6 text-on-dark sm:p-7" aria-label="Today's conversation">
      <PixelGrid active={chat.running} className="absolute inset-0 -z-10" />
      <h2 className="text-[22px] leading-snug" style={{ fontWeight: 460 }}>What do you want to talk about today?</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((p) => (
          <motion.button
            key={p.label}
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => void chat.send(p.text, { fresh: true, context: `Today's conversation · ${p.label.replace(/[[\]]/g, '')}${'ctx' in p && p.ctx ? ` · ${p.ctx}` : ''}` })}
            className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-white/[0.06] px-4 text-[15px] text-on-dark ring-1 ring-white/10 transition-colors hover:bg-white/10"
            style={{ fontWeight: 420 }}
          >
            <span aria-hidden className="text-[17px] leading-none">{p.emoji}</span>
            {p.label}
          </motion.button>
        ))}
      </div>
    </section>
  )
}
