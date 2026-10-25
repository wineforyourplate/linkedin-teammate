import { useEffect, useState } from 'react'
import { lemmaClient } from '@/lemma-client'
import type { BrandImage, BrandKitData, Profile } from './types'

/* The brand kit's working parts: colours (text is always computed for contrast, never
   picked), fonts (Google Fonts, checked to load with a bold weight), and images (the
   logo, wordmark and headshot, kept under /me/brand). The carousel renderer reads the
   same kit, so what the preview shows is what the slides get. */

// ── colour ────────────────────────────────────────────────────────────────────

export const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function norm(hex: string): string {
  const h = hex.trim().replace(/^#?/, '#').toLowerCase()
  return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h
}

function rgb(hex: string): [number, number, number] {
  const h = norm(hex).slice(1)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function toHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Near-black or white, whichever reads better on this colour (same rule as the renderer). */
export const inkOn = (bg: string) => (luminance(bg) > 0.36 ? '#0b0d0c' : '#ffffff')

export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)]
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

/** The backgrounds, unless they set their own: a whisper of the brand colour on white, and on near-black. */
export const derivedLight = (primary: string) => mix('#ffffff', primary, 0.045)
export const derivedDark = (primary: string) => mix('#111116', primary, 0.14)

export interface Palette { primary: string; secondary: string | null; light: string; dark: string }

export function palette(kit: BrandKitData | null | undefined): Palette {
  const primary = kit?.colors?.primary && HEX.test(kit.colors.primary) ? norm(kit.colors.primary) : '#5266eb'
  const ok = (v?: string | null) => (v && HEX.test(v) ? norm(v) : null)
  return {
    primary,
    secondary: ok(kit?.colors?.secondary),
    light: ok(kit?.colors?.light) || derivedLight(primary),
    dark: ok(kit?.colors?.dark) || derivedDark(primary),
  }
}

export type SlideStyle = 'dark' | 'light' | 'brand'

/** What a slide in this style looks like: background, text, highlight. */
export function themeFor(p: Palette, style: SlideStyle) {
  if (style === 'brand') {
    const ink = inkOn(p.primary)
    return { bg: p.primary, ink, dim: mix(ink, p.primary, 0.22), accent: ink, panel: mix(p.primary, ink, 0.08), markInk: p.primary }
  }
  const bg = style === 'light' ? p.light : p.dark
  const ink = style === 'light' ? (luminance(bg) > 0.36 ? '#141414' : '#f6f6f8') : (luminance(bg) > 0.36 ? '#141414' : '#f3f4f6')
  // a brand colour that disappears on this background gives way to the second colour, if that reads
  const accent = contrast(p.primary, bg) >= 3 || !p.secondary || contrast(p.secondary, bg) < 3 ? p.primary : p.secondary
  return { bg, ink, dim: mix(ink, bg, 0.3), accent, panel: style === 'light' ? '#ffffff' : mix(bg, '#ffffff', 0.06), markInk: inkOn(accent) }
}

/** Plain-language contrast problems for the kit's colours. */
export function colourWarnings(p: Palette): string[] {
  const out: string[] = []
  const onLight = contrast(p.primary, p.light)
  const onDark = contrast(p.primary, p.dark)
  if (onLight < 3) out.push(`Your brand colour is faint on light slides (${onLight.toFixed(1)}:1). Big headlines need 3:1. Darken it a little, or use Dark slides.`)
  if (onDark < 3) out.push(`Your brand colour is faint on dark slides (${onDark.toFixed(1)}:1).${p.secondary && contrast(p.secondary, p.dark) >= 3 ? ' I’ll use your second colour for highlights there.' : ' Lighten it, or use Light slides.'}`)
  return out
}

export const PRESETS = ['#5266eb', '#0a66c2', '#0f766e', '#16a34a', '#ea580c', '#e11d48', '#9333ea', '#111827']

// ── fonts ─────────────────────────────────────────────────────────────────────

// first six: three clean sans, three with character, so the first look has range
export const HEADING_FONTS = [
  'Inter Tight', 'Bricolage Grotesque', 'Fraunces', 'Space Grotesk', 'DM Serif Display', 'Archivo',
  'Sora', 'Playfair Display', 'Manrope', 'Instrument Serif', 'Plus Jakarta Sans', 'Syne', 'Outfit', 'Unbounded', 'Libre Baskerville', 'Anton',
]
export const BODY_FONTS = ['Inter', 'DM Sans', 'IBM Plex Sans', 'Source Sans 3', 'Manrope', 'Plus Jakarta Sans', 'Work Sans', 'Lora']

const loaded = new Set<string>(['Inter', 'Bricolage Grotesque'])

/** Load a Google font into this page (once). */
export function loadFont(family?: string | null) {
  if (!family || loaded.has(family)) return
  loaded.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700&display=swap`
  document.head.appendChild(link)
}

export function useFonts(...families: (string | null | undefined)[]) {
  const key = families.filter(Boolean).join('|')
  useEffect(() => { for (const f of key.split('|')) loadFont(f) }, [key])
}

/** Is this a Google font with a bold weight? (Google answers 400 when it isn't.) */
export async function checkFont(family: string): Promise<'ok' | 'missing' | 'no-bold'> {
  const fam = encodeURIComponent(family.trim()).replace(/%20/g, '+')
  try {
    const bold = await fetch(`https://fonts.googleapis.com/css2?family=${fam}:wght@700&display=swap`)
    if (bold.ok) return 'ok'
    const any = await fetch(`https://fonts.googleapis.com/css2?family=${fam}&display=swap`)
    return any.ok ? 'no-bold' : 'missing'
  } catch {
    return 'missing'
  }
}

export const fontStack = (f?: string | null, fallback = 'Inter') => `"${f || fallback}", "Inter", system-ui, sans-serif`

// ── images ────────────────────────────────────────────────────────────────────

const urls = new Map<string, string>()

/** A displayable URL for a kit image: its web address, or the uploaded file as a blob URL. */
export function useBrandImage(img?: BrandImage | null): string | null {
  const key = img?.path || ''
  const [src, setSrc] = useState<string | null>(img?.url || (key ? urls.get(key) || null : null))
  useEffect(() => {
    if (img?.url && !key) { setSrc(img.url); return }
    if (!key) { setSrc(null); return }
    if (urls.has(key)) { setSrc(urls.get(key)!); return }
    let live = true
    lemmaClient.files.download(key).then((blob) => {
      const u = URL.createObjectURL(blob)
      urls.set(key, u)
      if (live) setSrc(u)
    }).catch(() => { if (live) setSrc(img?.url || null) })
    return () => { live = false }
  }, [key, img?.url])
  return src
}

export interface Checked { blob: Blob; name: string; width: number; height: number; tone: 'dark' | 'light' | null; note: string | null; preview: string }

/** Read an image they picked: trim empty margins, measure it, tell whether it's dark or light. */
export async function prepareImage(file: File, kind: 'logo' | 'wordmark' | 'photo'): Promise<Checked> {
  const ok = /image\/(png|svg\+xml|webp|jpeg)/.test(file.type)
  if (!ok) throw new Error('That isn’t an image I can use. PNG, SVG, WebP or JPG.')
  const ext = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('I couldn’t open that image.'))
    i.src = url
  })
  const w = img.naturalWidth || 512
  const h = img.naturalHeight || 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  // find what's actually drawn (non-transparent), and how bright it is
  let [x0, y0, x1, y1] = [w, h, -1, -1]
  let lum = 0
  let n = 0
  let transparent = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = data[i + 3]
      if (a < 12) { transparent++; continue }
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
      n++
    }
  }
  const hasAlpha = transparent > w * h * 0.02
  const tone: Checked['tone'] = kind === 'photo' || !hasAlpha || !n ? null : lum / n > 0.62 ? 'light' : 'dark'
  let blob: Blob = file
  let [outW, outH] = [w, h]
  const margin = x1 >= 0 && (x0 > 2 || y0 > 2 || x1 < w - 3 || y1 < h - 3)
  if (kind !== 'photo' && ext !== 'svg' && hasAlpha && margin) {
    // trim the empty border so the mark sits at its real size
    const pad = 2
    const cw = x1 - x0 + 1 + pad * 2
    const ch = y1 - y0 + 1 + pad * 2
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    out.getContext('2d')!.drawImage(canvas, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch)
    blob = await new Promise<Blob>((res) => out.toBlob((b) => res(b || file), 'image/png'))
    ;[outW, outH] = [cw, ch]
  }
  let note: string | null = null
  if (ext === 'jpg' && kind !== 'photo') note = 'A JPG has a solid background. A PNG or SVG with a transparent background sits cleanly on any slide.'
  else if (kind === 'logo' && ext !== 'svg' && Math.min(outW, outH) < 256) note = `It’s small (${outW}×${outH}). It may look soft on slides; 256 px or more is best.`
  else if (kind === 'wordmark' && ext !== 'svg' && outW < 600) note = `It’s narrow (${outW} px wide). It may look soft on slides; 600 px or more is best.`
  else if (kind === 'photo' && Math.min(outW, outH) < 400) note = `It’s small (${outW}×${outH}). 400×400 or more looks sharp.`
  URL.revokeObjectURL(url)
  const ready = ext === 'svg' || blob === file ? ext : 'png'
  return { blob, name: `${kind}-${Date.now().toString(36)}.${ready}`, width: outW, height: outH, tone, note, preview: URL.createObjectURL(blob) }
}

/** Save it under /me/brand and return the kit entry. */
export async function uploadImage(c: Checked): Promise<BrandImage> {
  const put = () => lemmaClient.files.upload(c.blob, { directoryPath: '/me/brand', name: c.name, searchEnabled: false, description: 'Brand kit image for carousels' })
  let f
  try {
    f = await put()
  } catch {
    // the folder may not exist yet
    await lemmaClient.files.folder.create('brand', { directoryPath: '/me' }).catch(() => undefined)
    f = await put()
  }
  urls.set(f.path, c.preview)
  return { path: f.path, id: f.id, tone: c.tone }
}

// ── defaults ──────────────────────────────────────────────────────────────────

export function domain(url?: string | null): string | null {
  if (!url) return null
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** The kit as it stands, with every gap filled from their profile or a sensible default. */
export function withDefaults(kit: BrandKitData | null | undefined, p: Profile | null): BrandKitData {
  const k = kit || {}
  const company = (k.posting_as || 'me') === 'company'
  return {
    ...k,
    posting_as: k.posting_as || 'me',
    name: k.name ?? (company ? p?.company_name : p?.linkedin_name || p?.display_name) ?? '',
    byline: k.byline ?? (company ? domain(p?.website) : p?.headline?.split(/[|·]/)[0]?.trim().slice(0, 36)) ?? '',
    headshot: k.headshot ?? !company,
    logo_on: k.logo_on || 'cover_cta',
    fonts: { heading: k.fonts?.heading || 'Inter Tight', body: k.fonts?.body || 'Inter' },
    style: k.style || 'dark',
    slide_numbers: k.slide_numbers ?? true,
    swipe: k.swipe ?? 'Swipe →',
    cta: { ask: k.cta?.ask || 'follow', line: k.cta?.line ?? '', keyword: k.cta?.keyword ?? '', link: k.cta?.link ?? domain(p?.website) ?? '' },
    website: k.website ?? p?.website ?? '',
  }
}

export const ASKS = [
  { key: 'follow', label: 'Follow me' },
  { key: 'comment', label: 'Comment' },
  { key: 'repost', label: 'Repost' },
  { key: 'dm', label: 'DM me a word' },
  { key: 'link', label: 'Visit a link' },
] as const

/** The last slide's ask, written out, unless they wrote their own. */
export function ctaText(k: BrandKitData): { action: string; detail: string } {
  const first = (k.name || '').split(' ')[0] || 'me'
  const line = k.cta?.line?.trim()
  switch (k.cta?.ask) {
    case 'comment': return { action: line || 'What would you add?', detail: 'Tell me in the comments' }
    case 'repost': return { action: line || 'Repost to help one person', detail: 'Someone in your network needs this' }
    case 'dm': return { action: line || `DM me “${(k.cta?.keyword || 'PLAYBOOK').toUpperCase()}”`, detail: 'I’ll send you the full version' }
    case 'link': return { action: line || 'Get the full guide', detail: k.cta?.link || 'Link in the post' }
    default: return { action: line || `Follow ${k.posting_as === 'company' ? k.name || 'us' : first} for more`, detail: 'and tap the bell so you don’t miss the next one' }
  }
}
