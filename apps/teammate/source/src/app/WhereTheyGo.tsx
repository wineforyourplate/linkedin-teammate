import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { usePod } from '@/lib/data'
import type { Destination, Kpi } from '@/lib/types'
import { KPI_LABEL, LADDERS, cleanLink, destReady, kpiOrder } from '@/lib/world'
import { Button } from '@/components/ui'
import { DestinationForm } from '@/components/DestinationForm'

/* Where people go: the same six choices and link fields as the onboarding, editable any
   time, with how posts will end for that choice, and what gets counted first. */

const same = (a: Destination | null | undefined, b: Destination | null | undefined) => (a?.kind || '') === (b?.kind || '') && (a?.link || '') === (b?.link || '') && (a?.detail || '') === (b?.detail || '') && !a?.guess === !b?.guess

export function WhereTheyGo() {
  const pod = usePod()
  const p = pod.profile
  const saved = p?.destination || null
  const [d, setD] = useState<Destination | null>(saved)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const dirty = !same(d, saved) || !!saved?.guess
  const save = async () => {
    if (!p || !d) return
    setBusy(true)
    const next: Destination = { kind: d.kind, link: d.kind === 'none' ? null : cleanLink(d.link || ''), detail: d.detail || null, guess: false }
    await pod.update('profile', p.id, { destination: next, skipped: (p.skipped || []).filter((s) => s !== 'dest') })
    setD(next)
    setBusy(false)
    setDone(true)
    window.setTimeout(() => setDone(false), 2400)
  }
  const kpis: Kpi[] = p?.kpi_order?.length ? p.kpi_order : kpiOrder((p?.goals as string[]) || [])
  const promote = (k: Kpi) => p && void pod.update('profile', p.id, { kpi_order: [k, ...kpis.filter((x) => x !== k)] })

  return (
    <>
      <section aria-label="Where people go next" className="flex flex-col gap-3">
        <p className="text-[14.5px] text-ink-2">{saved?.guess ? 'My guess, from your website. Keep it or change it.' : 'When a post lands, this is what it asks people to do next.'}</p>
        <DestinationForm value={d} onChange={(v) => { setD(v); setDone(false) }} guessed={saved?.guess ? saved.kind : null} />
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Button variant="primary" busy={busy} disabled={!dirty || !destReady(d)} onClick={() => void save()}>Save</Button>
          {done ? <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1.5 text-[14px] text-ink-2"><Check className="size-4" /> Saved. New posts end this way.</motion.span> : dirty && d && !destReady(d) ? <span className="text-[13px] text-slate">Add the link to save.</span> : null}
        </div>
      </section>
      {d?.kind ? (
        <Block title="How your posts will end" sub="Most posts start a conversation; a few send people somewhere.">
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
            {LADDERS[d.kind].map(([a, b]) => (
              <li key={a} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="shrink-0 text-[13.5px] text-ink sm:w-28" style={{ fontWeight: 560 }}>{a}</span>
                <span className="text-[14px] text-ink-2">{b}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
      <Block title="What I count first" sub="From your goals. Tap one to move it to the front.">
        <ol className="flex flex-wrap gap-2">
          {kpis.map((k, i) => (
            <li key={k}>
              <motion.button layout type="button" onClick={() => promote(k)} disabled={i === 0} className="min-h-10 rounded-pill bg-canvas px-4 text-[14px] text-ink ring-1 ring-line hover:ring-ink/30 disabled:cursor-default disabled:bg-ink disabled:text-white disabled:ring-ink" aria-label={i === 0 ? `${KPI_LABEL[k]}, counted first` : `Count ${KPI_LABEL[k]} first`}>
                <span className="tabular opacity-70">{i + 1}</span> · {KPI_LABEL[k]}
              </motion.button>
            </li>
          ))}
        </ol>
      </Block>
    </>
  )
}

function Block({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-[17px] text-ink" style={{ fontWeight: 520 }}>{title}</h2>
      {sub ? <p className="mb-4 mt-1 text-[14px] text-ink-2">{sub}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}
