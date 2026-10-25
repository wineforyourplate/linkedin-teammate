import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileUp, X } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import { Button, Card, Eyebrow } from '@/components/ui'
import { NeedsAccess, useHasAccess, type AccessAsk } from '@/components/NeedsAccess'

/* "Write like me", finished later. Until they import their posts the teammate writes
   in a clean default style; this card stays on Today until it's done, and You → How
   you write opens the same flow any time after. Two ways in: read them from LinkedIn
   (needs their browser, asked for right here, at the moment it's needed), or upload
   LinkedIn's data export / paste a few posts. */

const MAX_POSTS = 25

/** Pull post texts out of LinkedIn's data export (Shares.csv: Date, ShareLink, ShareCommentary, …). */
export function postsFromExport(csv: string): string[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase())
  const col = head.findIndex((h) => h === 'sharecommentary' || h === 'commentary' || h === 'text')
  if (col < 0) return []
  return rows.map((r) => (r[col] || '').replace(/""/g, '"').trim()).filter((t) => t.length > 40)
}

export function useVoiceImport() {
  const pod = usePod()
  const chat = useChat()
  const signedIn = useHasAccess('browser')
  const [ask, setAsk] = useState<AccessAsk | null>(null)
  const [uploading, setUploading] = useState(false)
  const p = pod.profile
  const fromLinkedIn = () => {
    if (p) void pod.update('profile', p.id, { voice_import: 'reading' })
    void chat.task('[voice] import')
  }
  const startLinkedIn = () => {
    if (signedIn) return fromLinkedIn()
    setAsk({
      title: 'To learn your voice, I need to read your LinkedIn posts',
      why: 'I read them in your own Lemma browser, signed in as you. Read-only: nothing is posted or liked. You get your last 20 posts turned into a voice you can edit, in about two minutes.',
      access: 'browser',
      instead: { label: 'Upload my posts instead', run: () => setUploading(true) },
    })
  }
  return { ask, setAsk, uploading, setUploading, startLinkedIn, fromLinkedIn }
}

/** The Today card, shown while "write like me" is waiting for their posts. */
export function VoiceImportCard() {
  const pod = usePod()
  const p = pod.profile
  const flow = useVoiceImport()
  const reading = p?.voice_import === 'reading'
  useWaitFor(reading, ['profile', 'facts', 'activity'], 5000, 15 * 60 * 1000)
  if (!p || p.voice_mode !== 'mine' || (p.voice_import !== 'todo' && p.voice_import !== 'reading')) return null
  const last = pod.activity.find((a) => a.skill === 'voice' || a.skill === 'learning')
  return (
    <Card tint>
      <Eyebrow>Your voice</Eyebrow>
      {reading ? (
        <>
          <p className="mt-2 text-[17px] text-ink">Reading your posts…</p>
          <p className="mt-1 flex items-center gap-2 text-[14px] text-ink-2"><span className="size-1.5 animate-pulse rounded-full bg-primary" />{last?.detail || 'Learning how you open, how long you go, how you end.'}</p>
        </>
      ) : (
        <>
          <h2 className="mt-2 text-[21px] leading-snug text-ink" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Teach me your voice</h2>
          <p className="mt-1 text-[15px] text-ink-2">Right now I write in a clean, plain style. Show me your posts and every draft sounds like you.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={flow.startLinkedIn}>Import from LinkedIn</Button>
            <Button onClick={() => flow.setUploading(true)}>Upload or paste posts</Button>
          </div>
        </>
      )}
      <NeedsAccess ask={flow.ask} onReady={flow.fromLinkedIn} onClose={() => flow.setAsk(null)} />
      <UploadPosts open={flow.uploading} onClose={() => flow.setUploading(false)} />
    </Card>
  )
}

/** Upload LinkedIn's export, or paste posts. Each becomes a voice sample; then the teammate learns from them. */
export function UploadPosts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pod = usePod()
  const chat = useChat()
  const [text, setText] = useState('')
  const [found, setFound] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pasted = text.split(/\n\s*(?:---+|\n)\s*\n?/).map((t) => t.trim()).filter((t) => t.length > 40)
  const posts = (found.length ? found : pasted).slice(0, MAX_POSTS)

  const readFile = async (file: File) => {
    setError('')
    const content = await file.text()
    const got = postsFromExport(content)
    if (!got.length) setError('I couldn’t find any posts in that file. In LinkedIn’s export it’s called Shares.csv.')
    setFound(got)
  }
  const save = async () => {
    if (!posts.length || !pod.profile) return
    setSaving(true)
    for (const post of posts) await pod.create('facts', { section: 'voice', kind: 'fact', label: 'A post you wrote', value: post.slice(0, 3000), source: 'you uploaded it', confidence: 1 })
    await pod.update('profile', pod.profile.id, { voice_import: 'reading' })
    void chat.task(`[voice] learn from the ${posts.length} posts they just uploaded`)
    setSaving(false)
    setText('')
    setFound([])
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171721]/50 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label="Upload or paste your posts" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] text-ink sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[22px] leading-snug" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Show me your posts</h2>
              <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-slate hover:bg-primary/8" aria-label="Close"><X className="size-4" /></button>
            </div>
            <p className="mt-2 text-[14px] text-ink-2">The quickest: LinkedIn’s own export. Settings → Data privacy → Get a copy of your data → Posts. It arrives by email in a few minutes; upload the Shares.csv file here.</p>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-lavender/50 p-4 text-[14px] text-ink hover:bg-lavender">
              <FileUp className="size-5 text-primary" />
              <span>{found.length ? `${found.length} posts found${found.length > MAX_POSTS ? `, I’ll use the latest ${MAX_POSTS}` : ''}` : 'Upload Shares.csv'}</span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f) }} />
            </label>
            {error ? <p className="mt-2 text-[13px] text-[#8a4b00]">{error}</p> : null}
            <p className="mt-5 text-[13px] text-ink-2">Or paste a few posts, with an empty line between them.</p>
            <textarea value={text} onChange={(e) => { setText(e.target.value); setFound([]) }} rows={6} className="mt-2 w-full rounded-xl bg-canvas p-3 text-[14px] leading-relaxed ring-1 ring-line focus:outline-none focus:ring-primary" placeholder="Paste a post you wrote…" aria-label="Paste your posts" />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" busy={saving} disabled={!posts.length} onClick={() => void save()}>{posts.length ? `Learn from ${posts.length} post${posts.length > 1 ? 's' : ''}` : 'Learn from these'}</Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
