import type { Draft } from './types'

type Send = (text: string, opts?: { silent?: boolean; fresh?: boolean; context?: string }) => Promise<string | null>

/** Shape an idea into a post in conversation: a fresh chat, the idea's id carried as context. */
export function talkThrough(send: Send, d: Draft) {
  return send(`Let’s work on this one: “${d.title || 'this idea'}”. Ask me a question or two to get my angle, then draft it here.`, {
    fresh: true,
    context: `Idea ${d.id}`,
  })
}

/** Not sure what to post: talk it through from scratch. */
export function whatToPost(send: Send) {
  return send('What should I post about this week? Give me three angles from my work and my field, and we’ll pick one together.', { fresh: true, context: 'Finding something to post about' })
}
