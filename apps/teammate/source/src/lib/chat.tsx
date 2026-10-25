import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useConversationMessages } from 'lemma-sdk/react'
import type { ConversationMessage } from 'lemma-sdk'
import { lemmaClient } from '@/lemma-client'

/* The teammate, beside every view. One conversation at a time with the `teammate`
   agent. Every message carries "[App] [Viewing: …]" so "this draft" means the one on
   screen. A LinkedIn sign-in pauses the run and shows a button that opens a live view
   of the person's own Lemma browser; the run resumes once they're signed in. */

export const AGENT = 'teammate'
const PREFIX = /^\[App\]\s*(?:\[Viewing: ([^\]]*)\]\s*)?/

export interface Step {
  id: string
  text: string
  failed: boolean
}
export type Block =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'text'; id: string; text: string }
  | { kind: 'signin'; id: string; toolCallId: string; origin: string; done: boolean }
  | { kind: 'steps'; id: string; steps: Step[] }

interface ChatApi {
  blocks: Block[]
  running: boolean
  conversationId: string | null
  error: string
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /** fresh: start a new conversation for this. context: what's on screen, overriding the view (hidden from the bubble). */
  send: (text: string, opts?: { silent?: boolean; fresh?: boolean; context?: string }) => Promise<string | null>
  /** Start a background job in its own conversation, so it never queues behind (or blocks) the chat. */
  task: (text: string) => Promise<string | null>
  newChat: () => void
  setContext: (context: string) => void
  signInLink: (toolCallId: string) => string | null
}

const Ctx = createContext<ChatApi | null>(null)
/** For the dev-only screen preview. */
export const ChatContext = Ctx
export type { ChatApi }
export const useChat = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useChat outside ChatProvider')
  return v
}

/** Tell the teammate what's on screen while a view is mounted. */
export function useChatContext(context: string) {
  const { setContext } = useChat()
  useEffect(() => setContext(context), [context, setContext])
}

export function ChatProvider({ children, onTurnEnd }: { children: ReactNode; onTurnEnd?: () => void }) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isOpen, setOpen] = useState(false)
  const [error, setError] = useState('')
  const contextRef = useRef('')
  const thread = useConversationMessages({ client: lemmaClient, agentName: AGENT, conversationId, syncOnTurnEnd: true })

  // A run paused on a sign-in (or a wait) has no stream to follow: check back until it moves.
  const paused = useMemo(() => {
    const last = [...thread.messages].reverse().find((m) => m.kind === 'TOOL_CALL' || (m.role === 'assistant' && m.kind === 'TEXT' && (m.text || '').trim()))
    return last?.kind === 'TOOL_CALL' && (last.tool_name === 'wait_for' || last.tool_name === 'browser_sign_in')
  }, [thread.messages])
  const resumeRef = useRef(thread.resumeIfRunning)
  resumeRef.current = thread.resumeIfRunning
  const refreshRef = useRef(thread.refresh)
  refreshRef.current = thread.refresh
  useEffect(() => {
    if (!conversationId || !paused || thread.isRunning) return
    const t = window.setInterval(() => {
      resumeRef.current(conversationId).then((running) => (running ? undefined : refreshRef.current())).catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(t)
  }, [conversationId, paused, thread.isRunning])

  const send = useCallback(
    async (text: string, opts: { silent?: boolean; fresh?: boolean; context?: string } = {}) => {
      const prompt = text.trim()
      if (!prompt) return null
      setError('')
      const where = opts.context || contextRef.current
      const content = '[App] ' + (where ? `[Viewing: ${where}]\n` : '') + prompt
      try {
        let id = opts.fresh ? null : conversationId
        let known = null
        if (!id) {
          const created = await thread.createConversation({ title: prompt.slice(0, 80) })
          id = created.id
          known = created
          setConversationId(created.id)
        }
        if (!opts.silent) setOpen(true)
        thread.sendMessage(content, { conversationId: id, knownConversation: known, syncOnTurnEnd: true }).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        return id
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return null
      }
    },
    [conversationId, thread],
  )

  const task = useCallback(async (text: string) => {
    try {
      const c = await lemmaClient.conversations.createForAgent(AGENT, { title: text.slice(0, 80) })
      await lemmaClient.conversations.appendMessage(c.id, { content: text })
      return c.id
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    }
  }, [])

  const signInLink = useCallback(
    (toolCallId: string) => {
      if (!conversationId) return null
      const base = new URL((lemmaClient as unknown as { authUrl?: string }).authUrl || location.origin).origin
      return `${base}/sign-in-to-site/${conversationId}/${toolCallId}`
    },
    [conversationId],
  )

  const blocks = useMemo(() => toBlocks(thread.messages), [thread.messages])

  // When a turn ends, the teammate has usually written rows: re-read them.
  const wasRunning = useRef(false)
  const turnEndRef = useRef(onTurnEnd)
  turnEndRef.current = onTurnEnd
  useEffect(() => {
    if (wasRunning.current && !thread.isRunning) turnEndRef.current?.()
    wasRunning.current = thread.isRunning
  }, [thread.isRunning, thread.messages.length])

  const api: ChatApi = {
    blocks,
    running: thread.isRunning || paused,
    conversationId,
    error,
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen((v) => !v),
    send,
    task,
    newChat: () => {
      setConversationId(null)
      setError('')
    },
    setContext: useCallback((c: string) => {
      contextRef.current = c
    }, []),
    signInLink,
  }
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

/* ---------- messages → what we draw ---------- */

const QUIET = new Set(['search_tools', 'load_skill', 'final_result', 'write_todos', 'todo_write', 'update_plan'])
const READS = new Set(['pod_read_file', 'pod_search_files', 'pod_list_files'])

function args(m: ConversationMessage): Record<string, unknown> {
  const a = m.tool_args as unknown
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const r = a as Record<string, unknown>
    return r.request && typeof r.request === 'object' ? (r.request as Record<string, unknown>) : r
  }
  if (typeof a === 'string') {
    try {
      return JSON.parse(a) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function stepLabel(name: string, a: Record<string, unknown>): string {
  const said = typeof a.comment === 'string' ? a.comment.trim() : typeof a.description === 'string' ? a.description.trim() : ''
  if (said) return said.charAt(0).toUpperCase() + said.slice(1)
  switch (name) {
    case 'pod_query':
    case 'pod_get_records':
    case 'pod_tables':
      return 'Looked at your data'
    case 'pod_write_record':
      return 'Saved it'
    case 'pod_read_file':
    case 'pod_search_files':
    case 'pod_list_files':
      return 'Read its notes'
    case 'pod_write_file':
    case 'pod_edit_file':
      return 'Updated its notes'
    case 'exec_command':
    case 'execute_python':
    case 'manage_process':
      return 'Worked in your browser'
    case 'view_image':
      return 'Looked at the page'
    case 'web_search':
      return a.query ? `Searched the web for “${String(a.query).slice(0, 60)}”` : 'Searched the web'
    case 'web_fetch':
      return 'Read a web page'
    case 'message_user':
      return 'Sent you a message'
    case 'wait_for':
      return 'Waited ' + (Number(a.seconds) || 30) + 's'
    case 'function_allowance':
      return "Checked today's budget"
    default:
      return name.replace(/^function_/, 'Ran ').replace(/_/g, ' ')
  }
}

function failedResult(m: ConversationMessage): boolean {
  const r = m.tool_result as unknown
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  return o.success === false || (typeof o.error === 'string' && o.error.length > 0)
}

export function toBlocks(messages: ConversationMessage[]): Block[] {
  const out: Block[] = []
  const returned = new Set(messages.filter((m) => m.kind === 'TOOL_RETURN').map((m) => m.tool_call_id))
  const failed = new Set(messages.filter((m) => m.kind === 'TOOL_RETURN' && failedResult(m) && !READS.has(m.tool_name || '')).map((m) => m.tool_call_id))
  for (const m of messages) {
    const id = m.id || String(m.sequence)
    if (m.role === 'user' && m.kind === 'TEXT') {
      const raw = m.text || ''
      const match = raw.match(PREFIX)
      const text = match ? raw.slice(match[0].length) : raw
      if (text.startsWith('[onboarding]')) continue
      out.push({ kind: 'user', id, text })
    } else if (m.role === 'assistant' && m.kind === 'TEXT' && (m.text || '').trim()) {
      out.push({ kind: 'text', id, text: m.text || '' })
    } else if (m.kind === 'TOOL_CALL' && m.tool_name) {
      const a = args(m)
      if (m.tool_name === 'browser_sign_in' && m.tool_call_id) {
        let origin = String(a.origin || a.url || 'linkedin.com')
        try {
          origin = new URL(origin).hostname
        } catch {
          /* already a host */
        }
        out.push({ kind: 'signin', id, toolCallId: m.tool_call_id, origin, done: returned.has(m.tool_call_id) })
        continue
      }
      if (QUIET.has(m.tool_name)) continue
      const step = { id, text: stepLabel(m.tool_name, a), failed: failed.has(m.tool_call_id) }
      const prev = out[out.length - 1]
      if (prev && prev.kind === 'steps') {
        const last = prev.steps[prev.steps.length - 1]
        if (last && last.text.replace(/ ×\d+$/, '') === step.text) {
          const n = Number(last.text.match(/×(\d+)$/)?.[1] || 1) + 1
          last.text = step.text + ' ×' + n
          last.failed = last.failed || step.failed
        } else prev.steps.push(step)
      } else out.push({ kind: 'steps', id, steps: [step] })
    }
  }
  return out
}
