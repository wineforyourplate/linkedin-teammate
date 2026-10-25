import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check, Globe, ImagePlus, Loader2, Pipette, RotateCcw, Search, X } from 'lucide-react'
import { usePod, useWaitFor } from '@/lib/data'
import { useChat } from '@/lib/chat'
import type { BrandImage, BrandKitData, BrandSuggestion } from '@/lib/types'
import {
  ASKS, BODY_FONTS, HEADING_FONTS, HEX, PRESETS, checkFont, colourWarnings, contrast, derivedDark, derivedLight, domain,
  fontStack, norm, palette, prepareImage, uploadImage, useBrandImage, useFonts, withDefaults, type SlideStyle,
} from '@/lib/brand'
import { Slide, type Marks, type Sample, type SlideKind } from '@/components/BrandPreview'
import { Button, Switch } from '@/components/ui'
import { cn } from '@/lib/utils'

/* The brand kit: what every carousel looks like, set once. The person comes first
   (headshot, name, byline: that's what LinkedIn carousels lead with), then their marks
   (logo, wordmark), colours and fonts. Text colours are computed for contrast, never
   picked. A live preview shows their own draft as slides, and "Start from your website"
   lets Spool find the logo, colours and fonts; what it finds waits here to be kept or
   skipped, and never overwrites what they set. */

const STYLES: { key: SlideStyle; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'brand', label: 'Brand colour' },
]

export function BrandKit() {
  const pod = usePod()
  const chat = useChat()
  const p = pod.profile
  const remote = p?.brand || null
  const [kit, setKit] = useState<BrandKitData>(() => remote || {})
  const kitRef = useRef(kit)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')

  // take the server's version when they aren't mid-edit (Spool's findings arrive this way)
  const remoteKey = JSON.stringify(remote)
  useEffect(() => {
    if (dirty.current) return
    const next = remote || {}
    kitRef.current = next
    setKit(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey])

  const save = async () => {
    if (!p) return
    window.clearTimeout(timer.current)
    const latest = pod.profile?.brand?.suggested
    const mine = kitRef.current
    // a newer import that landed while they were editing wins over the copy they had
    const suggested = latest?.at && latest.at !== mine.suggested?.at && mine.suggested !== null ? latest : mine.suggested
    await pod.update('profile', p.id, { brand: { ...mine, suggested } })
    dirty.current = false
    setSaved('saved')
  }
  const patch = (ch: Partial<BrandKitData>) => {
    const next = { ...kitRef.current, ...ch }
    kitRef.current = next
    setKit(next)
    dirty.current = true
    setSaved('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void save(), 600)
  }
  useEffect(() => () => { if (dirty.current) void save() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const full = withDefaults(kit, p)
  const pal = palette(full)
  const style = (full.style || 'dark') as SlideStyle
  const company = full.posting_as === 'company'
  useFonts(full.fonts?.heading, full.fonts?.body)

  const photoUp = useBrandImage(kit.photo)
  const marks: Marks = {
    photo: photoUp || p?.photo_url || null,
    logo: useBrandImage(kit.logo),
    logoDark: useBrandImage(kit.logo_dark),
    wordmark: useBrandImage(kit.wordmark),
    wordmarkDark: useBrandImage(kit.wordmark_dark),
  }

  // their own words on the slides: the newest draft with something to say
  const sample: Sample = useMemo(() => {
    const d = pod.drafts.find((x) => (x.body || '').trim().length > 80 && x.status !== 'killed')
    const lines = (d?.body || '').split(/\n+/).map((l) => l.trim()).filter(Boolean)
    const clip = (s: string, n: number) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n) > 20 ? s.lastIndexOf(' ', n) : n).replace(/[,.;:–—-]+$/, '') + '…' : s.replace(/[,;:–—-]+$/, ''))
    const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0]
    return lines.length >= 3
      ? { kicker: (p?.company_name || 'Field notes').slice(0, 22), cover: clip(firstSentence(lines[0]), 64), point: clip(firstSentence(lines[1]), 70), body: clip(lines[2], 90) }
      : { kicker: 'Field notes', cover: 'Three things I wish I knew earlier', point: 'Start with the problem, not the product.', body: 'Say it the way you would to a friend over coffee.' }
  }, [pod.drafts, p?.company_name])

  return (
    <div className="flex flex-col gap-5">
      <FromWebsite kit={full} suggested={kit.suggested || null} patch={patch} onAsk={(url) => { patch({ website: url, suggested: null }); void chat.task(`[brand] import ${url}`) }} />
      {kit.suggested ? <Review s={kit.suggested} kit={kit} patch={patch} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <aside className="h-fit xl:sticky xl:top-6 xl:order-2">
          <Preview kit={full} style={style} marks={marks} sample={sample} saved={saved} onStyle={(s) => patch({ style: s })} />
        </aside>

        <div className="flex min-w-0 flex-col gap-5 xl:order-1">
          <Panel title="You, on every slide" sub="On LinkedIn, carousels lead with the person. Your photo and name sit at the bottom of each slide.">
            <Seg value={full.posting_as || 'me'} onChange={(v) => patch({ posting_as: v as 'me' | 'company', name: null, byline: null })} options={[{ key: 'me', label: 'Posting as me' }, { key: 'company', label: 'As my company' }]} />
            {!company ? (
              <div className="mt-5 flex items-center gap-4">
                {marks.photo ? <img src={marks.photo} alt="" referrerPolicy="no-referrer" className={cn('size-16 rounded-full object-cover ring-1 ring-line', !full.headshot && 'opacity-40 grayscale')} /> : <span className="grid size-16 place-items-center rounded-full bg-lavender text-[22px] text-ink-2">{(full.name || '?').charAt(0)}</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <Switch checked={!!full.headshot} onChange={(v) => patch({ headshot: v })} label="Show my photo" />
                    <span className="text-[14px] text-ink">Show my photo</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2">{kit.photo ? 'The one you uploaded.' : p?.photo_url ? 'From your LinkedIn profile.' : 'I don’t have one yet.'}{' '}
                    <UploadLink kind="photo" label={kit.photo || p?.photo_url ? 'Use another' : 'Upload one'} onDone={(img) => patch({ photo: img, headshot: true })} />
                    {kit.photo ? <> · <button type="button" onClick={() => patch({ photo: null })} className="text-primary hover:underline">Use LinkedIn’s</button></> : null}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField label={company ? 'Company name' : 'Name'} value={full.name || ''} max={28} onChange={(v) => patch({ name: v })} />
              <TextField label="Under the name" value={full.byline || ''} max={36} onChange={(v) => patch({ byline: v })} placeholder="Your role, handle or website" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[p?.headline?.split(/[|·]/)[0]?.trim(), domain(p?.website), p?.role && p?.company_name ? `${p.role}, ${p.company_name}` : null]
                .filter((x): x is string => !!x && x.length <= 36 && x !== full.byline)
                .map((x) => <button key={x} type="button" onClick={() => patch({ byline: x })} className="rounded-pill bg-primary/8 px-3 py-1 text-[12.5px] text-ink-2 hover:bg-primary/14 hover:text-ink">{x}</button>)}
            </div>
          </Panel>

          <Panel title="Logo" sub="A square mark and your name as a wordmark. PNG or SVG with a transparent background works best; I trim empty edges.">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageSlot label="Logo mark" kind="logo" value={kit.logo} dark={kit.logo_dark} pal={pal} onChange={(v) => patch({ logo: v })} onDark={(v) => patch({ logo_dark: v })} />
              <ImageSlot label="Wordmark" kind="wordmark" value={kit.wordmark} dark={kit.wordmark_dark} pal={pal} onChange={(v) => patch({ wordmark: v })} onDark={(v) => patch({ wordmark_dark: v })} />
            </div>
            {!company && (kit.logo || kit.wordmark || kit.logo_dark || kit.wordmark_dark) ? (
              <div className="mt-5">
                <p className="mb-2 text-[13px] text-ink-2">Show it, top right, on</p>
                <Seg value={full.logo_on || 'cover_cta'} onChange={(v) => patch({ logo_on: v as BrandKitData['logo_on'] })} options={[{ key: 'cover_cta', label: 'First and last slide' }, { key: 'every', label: 'Every slide' }, { key: 'never', label: 'Never' }]} />
              </div>
            ) : null}
          </Panel>

          <Panel title="Colours" sub="One brand colour does most of the work: highlights, numbers, the last slide’s box. Text colours follow for contrast.">
            <div className="grid gap-5 sm:grid-cols-2">
              <ColourField label="Brand colour" value={pal.primary} onChange={(v) => patch({ colors: { ...kit.colors, primary: v } })} presets={PRESETS} />
              <ColourField label="Second colour" optional value={pal.secondary} onChange={(v) => patch({ colors: { ...kit.colors, secondary: v } })} onClear={() => patch({ colors: { ...kit.colors, secondary: null } })} />
            </div>
            {colourWarnings(pal).map((w) => <p key={w} className="mt-3 rounded-xl bg-[#fff6e6] px-3 py-2 text-[13px] text-[#7a4a00]">{w}</p>)}
            <Backgrounds kit={kit} pal={pal} patch={patch} />
          </Panel>

          <Panel title="Fonts" sub="Any Google font. Headlines need a bold weight, so I check that it has one.">
            <FontPicker label="Headlines" value={full.fonts?.heading || 'Inter Tight'} options={HEADING_FONTS} sample={sample.cover} big onPick={(f) => patch({ fonts: { ...kit.fonts, heading: f } })} />
            <div className="mt-6">
              <FontPicker label="Body text" value={full.fonts?.body || 'Inter'} options={BODY_FONTS} sample={sample.body} onPick={(f) => patch({ fonts: { ...kit.fonts, body: f } })} />
            </div>
          </Panel>

          <Panel title="Slides" sub="The default look. Any carousel can still change it.">
            <Seg value={style} onChange={(v) => patch({ style: v as SlideStyle })} options={STYLES.map((s) => ({ key: s.key, label: s.label }))} />
            <div className="mt-5 flex flex-col divide-y divide-line">
              <label className="flex items-center justify-between gap-4 py-3">
                <span><span className="block text-[14.5px] text-ink">Slide numbers</span><span className="block text-[12.5px] text-ink-2">“3/8” in the corner. LinkedIn shows its own counter too.</span></span>
                <Switch checked={full.slide_numbers !== false} onChange={(v) => patch({ slide_numbers: v })} label="Slide numbers" />
              </label>
              <div className="py-3">
                <TextField label="On the first slide" value={full.swipe ?? ''} max={18} onChange={(v) => patch({ swipe: v })} placeholder="Swipe →" />
              </div>
            </div>
          </Panel>

          <Panel title="The last slide" sub="What you ask people to do. Each carousel can change it.">
            <div className="flex flex-wrap gap-2">
              {ASKS.map((a) => {
                const on = (full.cta?.ask || 'follow') === a.key
                return <motion.button key={a.key} type="button" whileTap={{ scale: 0.96 }} aria-pressed={on} onClick={() => patch({ cta: { ...kit.cta, ask: a.key, line: null } })} className={cn('rounded-pill px-3.5 py-2 text-[13.5px] ring-1 transition-colors', on ? 'bg-primary text-white ring-primary' : 'bg-canvas text-ink ring-line hover:bg-lavender')}>{a.label}</motion.button>
              })}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField label="In your words (optional)" value={kit.cta?.line || ''} max={40} onChange={(v) => patch({ cta: { ...kit.cta, line: v } })} placeholder="Leave empty for my default" />
              {full.cta?.ask === 'dm' ? <TextField label="The word" value={kit.cta?.keyword || ''} max={16} onChange={(v) => patch({ cta: { ...kit.cta, keyword: v } })} placeholder="PLAYBOOK" /> : null}
              {full.cta?.ask === 'link' ? <TextField label="The link, as shown" value={full.cta?.link || ''} max={36} onChange={(v) => patch({ cta: { ...kit.cta, link: v } })} placeholder="lemma.work/guide" /> : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

// ── preview ───────────────────────────────────────────────────────────────────

function Preview({ kit, style, marks, sample, saved, onStyle }: { kit: BrandKitData; style: SlideStyle; marks: Marks; sample: Sample; saved: 'idle' | 'saving' | 'saved'; onStyle: (s: SlideStyle) => void }) {
  const kinds: { key: SlideKind; label: string }[] = [{ key: 'cover', label: 'First' }, { key: 'point', label: 'Inside' }, { key: 'cta', label: 'Last' }]
  const [one, setOne] = useState<SlideKind>('cover')
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] uppercase tracking-[0.06em] text-slate">Preview</p>
        <span className="flex items-center gap-1 text-[12px] text-slate" aria-live="polite">
          {saved === 'saving' ? <><Loader2 className="size-3 animate-spin" /> Saving</> : saved === 'saved' ? <><Check className="size-3 text-primary" /> Saved</> : null}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-pill bg-canvas p-1 ring-1 ring-line">
        {STYLES.map((s) => (
          <button key={s.key} type="button" aria-pressed={style === s.key} onClick={() => onStyle(s.key)} className={cn('rounded-pill py-1.5 text-[12px] transition-colors', style === s.key ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:text-ink')}>{s.key === 'brand' ? 'Brand' : s.label}</button>
        ))}
      </div>
      {/* wide screens: one slide at a time */}
      <div className="hidden xl:block">
        <Slide kit={kit} kind={one} style={style} marks={marks} sample={sample} />
        <div className="mt-3 flex justify-center gap-1">
          {kinds.map((k) => <button key={k.key} type="button" aria-pressed={one === k.key} onClick={() => setOne(k.key)} className={cn('rounded-pill px-3 py-1 text-[12.5px]', one === k.key ? 'bg-primary/10 text-ink' : 'text-ink-2 hover:text-ink')}>{k.label}</button>)}
        </div>
      </div>
      {/* everywhere else: all three, side by side */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden">
        {kinds.map((k) => (
          <div key={k.key} className="w-[44%] shrink-0 snap-start sm:w-[31%]">
            <Slide kit={kit} kind={k.key} style={style} marks={marks} sample={sample} />
            <p className="mt-1.5 text-center text-[12px] text-ink-2">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── start from the website ────────────────────────────────────────────────────

function FromWebsite({ kit, suggested, onAsk }: { kit: BrandKitData; suggested: BrandSuggestion | null; patch: (c: Partial<BrandKitData>) => void; onAsk: (url: string) => void }) {
  const pod = usePod()
  const [site, setSite] = useState(kit.website || '')
  const [sentAt, setSentAt] = useState<number | null>(null)
  const waiting = sentAt !== null && (!suggested?.at || new Date(suggested.at).getTime() < sentAt - 60000)
  useWaitFor(waiting, ['profile', 'activity'], 5000, 8 * 60 * 1000)
  useEffect(() => { if (!site && kit.website) setSite(kit.website) }, [kit.website]) // eslint-disable-line react-hooks/exhaustive-deps
  const last = waiting ? pod.activity.find((a) => a.skill === 'brand' && new Date(a.created_at || 0).getTime() > (sentAt || 0) - 5000) : null
  const host = domain(site)
  const [open, setOpen] = useState(false)
  const setUp = !!(kit.colors?.primary || kit.logo || kit.wordmark || kit.logo_dark)
  if (suggested && !waiting) return null
  if (setUp && !waiting && !open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-2 rounded-pill bg-primary/8 px-3.5 py-2 text-[13.5px] text-ink-2 hover:bg-primary/14 hover:text-ink">
        <Globe className="size-4 text-primary" /> Look at {domain(kit.website) || 'my website'} again
      </button>
    )
  return (
    <section className="rounded-2xl bg-lavender/70 p-5 ring-1 ring-primary/15 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-primary ring-1 ring-primary/15"><Globe className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] text-ink" style={{ fontWeight: 520 }}>Start from your website</h2>
          {waiting ? (
            <p className="mt-1 flex items-center gap-2 text-[14px] text-ink-2"><span className="size-1.5 animate-pulse rounded-full bg-primary" />{last?.detail || `Reading ${host}: logo, colours, fonts…`}</p>
          ) : (
            <>
              <p className="mt-1 text-[14px] text-ink-2">I’ll find your logo, colours and fonts, and show you what I found before anything changes.</p>
              <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (host) { setSentAt(Date.now()); onAsk(site.trim()) } }}>
                <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourcompany.com" aria-label="Your website" className="h-10 min-w-0 flex-1 rounded-pill bg-surface px-4 text-[14px] text-ink ring-1 ring-line focus:outline-none focus:ring-primary" inputMode="url" autoCapitalize="none" />
                <Button type="submit" variant="primary" disabled={!host}>Find my brand</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function SuggestImg({ img, className }: { img: BrandImage; className?: string }) {
  const src = useBrandImage(img)
  return src ? <img src={src} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} className={className} /> : <span className={cn('grid place-items-center text-slate', className)}><ImagePlus className="size-4" /></span>
}

function Review({ s, kit, patch }: { s: BrandSuggestion; kit: BrandKitData; patch: (c: Partial<BrandKitData>) => void }) {
  useFonts(s.heading, s.body)
  type Key = 'logo' | 'wordmark' | 'primary' | 'secondary' | 'heading' | 'body' | 'byline'
  const apply = (k: Key, cur: BrandKitData): Partial<BrandKitData> => {
    switch (k) {
      case 'logo': return s.logo?.tone === 'light' ? { logo_dark: s.logo } : { logo: s.logo }
      case 'wordmark': return s.wordmark?.tone === 'light' ? { wordmark_dark: s.wordmark } : { wordmark: s.wordmark }
      case 'primary': return { colors: { ...cur.colors, primary: s.primary } }
      case 'secondary': return { colors: { ...cur.colors, secondary: s.secondary } }
      case 'heading': return { fonts: { ...cur.fonts, heading: s.heading } }
      case 'body': return { fonts: { ...cur.fonts, body: s.body } }
      case 'byline': return { byline: s.byline }
    }
  }
  const rows: { key: Key; label: string; view: ReactNode }[] = []
  if (s.logo) rows.push({ key: 'logo', label: 'Logo mark', view: <SuggestImg img={s.logo} className="size-10 rounded-md bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:10px_10px] object-contain p-1" /> })
  if (s.wordmark) rows.push({ key: 'wordmark', label: 'Wordmark', view: <SuggestImg img={s.wordmark} className="h-10 w-32 rounded-md bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:10px_10px] object-contain p-1" /> })
  if (s.primary && HEX.test(s.primary)) rows.push({ key: 'primary', label: 'Brand colour', view: <Swatchline hex={s.primary} /> })
  if (s.secondary && HEX.test(s.secondary)) rows.push({ key: 'secondary', label: 'Second colour', view: <Swatchline hex={s.secondary} /> })
  if (s.heading) rows.push({ key: 'heading', label: 'Headline font', view: <span className="text-[18px] text-ink" style={{ fontFamily: fontStack(s.heading), fontWeight: 700 }}>{s.heading}</span> })
  if (s.body) rows.push({ key: 'body', label: 'Body font', view: <span className="text-[15px] text-ink" style={{ fontFamily: fontStack(s.body) }}>{s.body}</span> })
  if (s.byline) rows.push({ key: 'byline', label: 'Under your name', view: <span className="text-[14px] text-ink">{s.byline}</span> })
  const left = (without: Key[]): BrandSuggestion | null => {
    const next: BrandSuggestion = { ...s }
    for (const k of without) {
      if (k === 'logo' || k === 'wordmark') next[k] = null
      else next[k] = null
    }
    const any = (['logo', 'wordmark', 'primary', 'secondary', 'heading', 'body', 'byline'] as Key[]).some((k) => next[k])
    return any ? next : null
  }
  const use = (k: Key) => patch({ ...apply(k, kit), suggested: left([k]) })
  const skip = (k: Key) => patch({ suggested: left([k]) })
  const useAll = () => {
    let cur: BrandKitData = { ...kit }
    for (const r of rows) cur = { ...cur, ...apply(r.key, cur) }
    patch({ ...cur, suggested: null })
  }
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-surface p-5 ring-2 ring-primary/30 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] text-ink" style={{ fontWeight: 520 }}>Here’s what I found{s.from ? ` on ${domain(s.from) || s.from}` : ''}</h2>
          <p className="mt-1 text-[14px] text-ink-2">Keep what’s right. Nothing changes until you do.</p>
        </div>
        <button type="button" onClick={() => patch({ suggested: null })} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full text-slate hover:bg-primary/8"><X className="size-4" /></button>
      </div>
      {rows.length ? (
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="w-28 shrink-0 text-[13px] text-ink-2">{r.label}</span>
              <span className="min-w-0 flex-1">{r.view}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="tint" onClick={() => use(r.key)}>Use</Button>
                <Button size="sm" variant="ghost" onClick={() => skip(r.key)}>Skip</Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {s.notes ? <p className="mt-3 text-[13px] text-ink-2">{s.notes}</p> : null}
      {rows.length > 1 ? <div className="mt-4"><Button variant="primary" onClick={useAll}>Use all of it</Button></div> : null}
    </motion.section>
  )
}

function Swatchline({ hex }: { hex: string }) {
  return <span className="inline-flex items-center gap-2 text-[13.5px] text-ink"><span className="size-7 rounded-md ring-1 ring-black/10" style={{ background: hex }} />{norm(hex)}</span>
}

// ── pieces ────────────────────────────────────────────────────────────────────

function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-[17px] text-ink" style={{ fontWeight: 520 }}>{title}</h2>
      {sub ? <p className="mb-4 mt-1 text-[14px] text-ink-2">{sub}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

function Seg({ value, options, onChange }: { value: string; options: { key: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-pill bg-canvas p-1 ring-1 ring-line">
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} onClick={() => onChange(o.key)} className={cn('rounded-pill px-3.5 py-1.5 text-[13.5px] transition-colors', value === o.key ? 'bg-primary text-white' : 'text-ink-2 hover:text-ink')}>{o.label}</button>
      ))}
    </div>
  )
}

function TextField({ label, value, onChange, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[13px] text-ink-2"><span>{label}</span>{v.length > max * 0.7 ? <span className={cn(v.length > max && 'text-alert')}>{v.length}/{max}</span> : null}</span>
      <input value={v} placeholder={placeholder} onChange={(e) => { setV(e.target.value); onChange(e.target.value) }} className="h-10 rounded-xl bg-canvas px-3 text-[14.5px] text-ink ring-1 ring-line focus:outline-none focus:ring-primary" />
    </label>
  )
}

declare global {
  interface Window { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }
}

function ColourField({ label, value, onChange, onClear, presets, optional }: { label: string; value: string | null; onChange: (v: string) => void; onClear?: () => void; presets?: string[]; optional?: boolean }) {
  const [text, setText] = useState(value || '')
  useEffect(() => setText(value || ''), [value])
  const commit = (t: string) => { const h = t.startsWith('#') ? t : `#${t}`; if (HEX.test(h)) onChange(norm(h)); else setText(value || '') }
  const pick = async () => { try { const r = await new window.EyeDropper!().open(); onChange(norm(r.sRGBHex)) } catch { /* cancelled */ } }
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-ink-2">{label}{optional ? ' (optional)' : ''}</p>
      <div className="flex items-center gap-2">
        <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-black/10" style={{ background: value || 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/10px 10px' }}>
          <input type="color" value={value || '#888888'} onChange={(e) => onChange(norm(e.target.value))} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label}: pick`} />
        </label>
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text ? commit(text) : null} onKeyDown={(e) => { if (e.key === 'Enter') commit(text) }} placeholder={optional ? 'None' : '#5266eb'} aria-label={`${label}: hex`} className="h-10 w-28 rounded-xl bg-canvas px-3 font-mono text-[13.5px] text-ink ring-1 ring-line focus:outline-none focus:ring-primary" />
        {typeof window !== 'undefined' && window.EyeDropper ? <button type="button" onClick={() => void pick()} aria-label="Pick a colour from the screen" title="Pick from the screen (try your logo)" className="grid size-10 place-items-center rounded-xl text-ink-2 ring-1 ring-line hover:bg-lavender"><Pipette className="size-4" /></button> : null}
        {optional && value && onClear ? <button type="button" onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`} className="grid size-10 place-items-center rounded-xl text-slate hover:bg-primary/8"><X className="size-4" /></button> : null}
      </div>
      {presets ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {presets.map((c) => <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} className={cn('size-6 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110', value === c && 'ring-2 ring-ink ring-offset-2')} style={{ background: c }} />)}
        </div>
      ) : null}
    </div>
  )
}

function Backgrounds({ kit, pal, patch }: { kit: BrandKitData; pal: ReturnType<typeof palette>; patch: (c: Partial<BrandKitData>) => void }) {
  const [open, setOpen] = useState(!!(kit.colors?.light || kit.colors?.dark))
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-4 text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">Backgrounds: a hint of your colour, on light and dark. Change them</button>
  const row = (key: 'light' | 'dark', label: string, derived: string) => (
    <div className="flex items-center gap-2">
      <label className="relative size-9 cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: pal[key] }}>
        <input type="color" value={pal[key]} onChange={(e) => patch({ colors: { ...kit.colors, [key]: norm(e.target.value) } })} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label} background`} />
      </label>
      <span className="text-[13.5px] text-ink">{label}</span>
      <span className="font-mono text-[12px] text-slate">{pal[key]}</span>
      {kit.colors?.[key] && norm(kit.colors[key]!) !== derived ? <button type="button" onClick={() => patch({ colors: { ...kit.colors, [key]: null } })} className="inline-flex items-center gap-1 text-[12.5px] text-ink-2 hover:text-ink"><RotateCcw className="size-3" /> Reset</button> : null}
      {contrast(pal.primary, pal[key]) < 3 ? <span className="text-[12px] text-[#7a4a00]">brand colour is faint here</span> : null}
    </div>
  )
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl bg-canvas p-3 ring-1 ring-line">
      <p className="text-[12.5px] text-ink-2">Backgrounds. Text on them is set for you, always readable.</p>
      {row('light', 'Light slides', derivedLight(pal.primary))}
      {row('dark', 'Dark slides', derivedDark(pal.primary))}
    </div>
  )
}

function UploadLink({ kind, label, onDone }: { kind: 'logo' | 'wordmark' | 'photo'; label: string; onDone: (img: BrandImage) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <>
      <label className="cursor-pointer text-primary hover:underline">
        {busy ? 'Uploading…' : label}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true); setErr('')
          try { const c = await prepareImage(f, kind); onDone(await uploadImage(c)) } catch (x) { setErr((x as Error).message || 'That didn’t upload.') }
          setBusy(false)
        }} />
      </label>
      {err ? <span className="block text-alert">{err}</span> : null}
    </>
  )
}

function ImageSlot({ label, kind, value, dark, pal, onChange, onDark }: { label: string; kind: 'logo' | 'wordmark'; value?: BrandImage | null; dark?: BrandImage | null; pal: ReturnType<typeof palette>; onChange: (v: BrandImage | null) => void; onDark: (v: BrandImage | null) => void }) {
  const src = useBrandImage(value)
  const darkSrc = useBrandImage(dark)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const take = async (f: File | undefined, slot: 'main' | 'dark') => {
    if (!f) return
    setBusy(true); setErr(''); setNote(null)
    try {
      const c = await prepareImage(f, kind)
      const img = await uploadImage(c)
      // a light logo is the one for dark slides; file it there
      if (slot === 'main' && c.tone === 'light' && !dark) { onDark(img); setNote('This one is light, so I’ve kept it for dark slides. Add a dark version for light slides too.') }
      else (slot === 'main' ? onChange : onDark)(img)
      if (c.note) setNote(c.note)
    } catch (x) {
      setErr((x as Error).message || 'That didn’t upload.')
    }
    setBusy(false)
  }
  const wide = kind === 'wordmark'
  const tile = (s: string | null, bg: string) => (
    <span className="grid flex-1 place-items-center rounded-lg p-2.5" style={{ background: bg }}>
      {s ? <img src={s} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} className={cn('object-contain', wide ? 'h-7 max-w-full' : 'size-10')} /> : <span className="text-[11px]" style={{ color: bg === pal.dark ? '#fff8' : '#0006' }}>none</span>}
    </span>
  )
  const has = !!(src || darkSrc)
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-ink-2">{label}</p>
      {has ? (
        <div className="rounded-xl bg-canvas p-2 ring-1 ring-line">
          <div className="flex gap-2">
            {tile(src, pal.light)}
            {tile(darkSrc || (value?.tone !== 'dark' ? src : null), pal.dark)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12.5px]">
            <label className="cursor-pointer text-primary hover:underline">{busy ? 'Uploading…' : src ? 'Replace' : 'Add for light slides'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { void take(e.target.files?.[0], 'main'); e.target.value = '' }} /></label>
            <label className="cursor-pointer text-primary hover:underline">{darkSrc ? 'Replace dark-slide version' : 'Add one for dark slides'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { void take(e.target.files?.[0], 'dark'); e.target.value = '' }} /></label>
            <button type="button" onClick={() => { onChange(null); onDark(null); setNote(null) }} className="text-ink-2 hover:text-ink">Remove</button>
          </div>
        </div>
      ) : (
        <label className={cn('flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-lavender/40 px-3 text-center hover:bg-lavender', wide ? 'h-[104px]' : 'h-[104px]')}>
          {busy ? <Loader2 className="size-5 animate-spin text-primary" /> : <ImagePlus className="size-5 text-primary" />}
          <span className="text-[13.5px] text-ink">{busy ? 'Uploading…' : wide ? 'Add your wordmark' : 'Add your logo mark'}</span>
          <span className="text-[11.5px] text-ink-2">{wide ? 'Your name as a logo, wide' : 'Square, like an app icon'}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { void take(e.target.files?.[0], 'main'); e.target.value = '' }} />
        </label>
      )}
      {note ? <p className="mt-1.5 text-[12.5px] text-ink-2">{note}</p> : null}
      {err ? <p className="mt-1.5 text-[12.5px] text-alert">{err}</p> : null}
    </div>
  )
}

function FontPicker({ label, value, options, sample, big, onPick }: { label: string; value: string; options: string[]; sample: string; big?: boolean; onPick: (f: string) => void }) {
  const [q, setQ] = useState('')
  const [extra, setExtra] = useState<string[]>([])
  const [state, setState] = useState<'' | 'checking' | 'missing' | 'no-bold'>('')
  const [more, setMore] = useState(false)
  const all = [...new Set([...extra, ...options, value])]
  const matching = all.filter((f) => f.toLowerCase().includes(q.trim().toLowerCase()))
  const cap = big ? 6 : 4
  // the picked font always shows, even when it's past the first row
  const first = matching.slice(0, cap)
  const shown = more || q ? matching : first.includes(value) || !matching.includes(value) ? first : [...first.slice(0, cap - 1), value]
  useFonts(...shown)
  const exact = all.some((f) => f.toLowerCase() === q.trim().toLowerCase())
  const tryIt = async () => {
    const name = q.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setState('checking')
    const r = await checkFont(name)
    if (r === 'ok') { setExtra((x) => [name, ...x]); onPick(name); setQ(''); setState('') } else setState(r)
  }
  const words = big ? sample.split(' ').slice(0, 4).join(' ') : 'Say it the way you would to a friend.'
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-2">{label}: <span className="text-ink">{value}</span></p>
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setState('') }} placeholder="Search Google Fonts" aria-label={`Search fonts for ${label.toLowerCase()}`} className="h-8 w-48 rounded-pill bg-canvas pl-8 pr-3 text-[13px] text-ink ring-1 ring-line focus:outline-none focus:ring-primary" />
        </label>
      </div>
      <div className={cn('grid gap-2', big ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
        {shown.map((f) => {
          const on = f === value
          return (
            <button key={f} type="button" aria-pressed={on} onClick={() => onPick(f)} className={cn('flex min-w-0 flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition-colors', on ? 'bg-lavender ring-primary' : 'bg-canvas ring-line hover:bg-lavender/60')}>
              <span className={cn('line-clamp-2 w-full text-ink', big ? 'text-[19px] leading-tight' : 'text-[14px] leading-snug')} style={{ fontFamily: fontStack(f), fontWeight: big ? 700 : 400 }}>{words}</span>
              <span className="flex w-full items-center justify-between text-[11.5px] text-ink-2">{f}{on ? <Check className="size-3.5 text-primary" /> : null}</span>
            </button>
          )
        })}
      </div>
      {!q && matching.length > cap ? <button type="button" onClick={() => setMore((m) => !m)} className="mt-2 text-[13px] text-ink-2 underline-offset-4 hover:text-ink hover:underline">{more ? 'Fewer' : `${matching.length - cap} more`}</button> : null}
      {q.trim().length > 2 && !exact ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          <Button size="sm" variant="tint" busy={state === 'checking'} onClick={() => void tryIt()}>Use “{q.trim()}” from Google Fonts</Button>
          {state === 'missing' ? <span className="text-alert">Google Fonts doesn’t have that one. Check the spelling?</span> : null}
          {state === 'no-bold' ? <span className="text-[#7a4a00]">It has no bold weight, so headlines would look thin. Try another.</span> : null}
        </div>
      ) : null}
    </div>
  )
}
