import type { CSSProperties, ReactNode, SyntheticEvent } from 'react'
import type { BrandKitData } from '@/lib/types'
import { ctaText, fontStack, palette, themeFor, type SlideStyle } from '@/lib/brand'

/* Carousel slides drawn the way the renderer draws them (1080×1350, the same sizes and
   spacing), scaled to whatever width they're given. Sizes are in container units, so
   u(84) is 84 px on the real slide. */

const u = (px: number) => `${(px / 10.8).toFixed(3)}cqw`
const hide = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }

export interface Marks { photo: string | null; logo: string | null; logoDark: string | null; wordmark: string | null; wordmarkDark: string | null }
export type SlideKind = 'cover' | 'point' | 'cta'
export interface Sample { kicker: string; cover: string; point: string; body: string }

export function Slide({ kit, kind, style, marks, sample, className }: { kit: BrandKitData; kind: SlideKind; style: SlideStyle; marks: Marks; sample: Sample; className?: string }) {
  const p = palette(kit)
  const t = themeFor(p, style)
  const darkBg = style !== 'light'
  const company = kit.posting_as === 'company'
  const face = !company && kit.headshot ? marks.photo : null
  const logo = (darkBg && marks.logoDark) || marks.logo
  const wordmark = (darkBg && marks.wordmarkDark) || marks.wordmark
  const display = fontStack(kit.fonts?.heading, 'Inter Tight')
  const edge = kind === 'cover' || kind === 'cta'
  const showTop = !company && (wordmark || logo) && (kit.logo_on === 'every' || (kit.logo_on !== 'never' && edge))
  const page = kind === 'cover' ? kit.swipe || 'Swipe →' : kit.slide_numbers === false ? '' : kind === 'point' ? '2/6' : '6/6'
  const cta = ctaText(kit)

  const who: ReactNode = company ? (
    wordmark ? <img onError={hide} src={wordmark} alt="" style={{ height: u(46), maxWidth: u(420), objectFit: 'contain' }} />
      : <span style={{ display: 'flex', alignItems: 'center', gap: u(14) }}>{logo ? <img onError={hide} src={logo} alt="" style={{ height: u(44), maxWidth: u(180), objectFit: 'contain' }} /> : <i style={{ width: u(18), height: u(18), borderRadius: '50%', background: t.accent, display: 'inline-block' }} />}{kit.name || 'Your company'}</span>
  ) : (
    <span style={{ display: 'flex', alignItems: 'center', gap: u(20) }}>
      {face ? <img onError={hide} src={face} alt="" referrerPolicy="no-referrer" style={{ width: u(84), height: u(84), borderRadius: '50%', objectFit: 'cover' }} /> : null}
      <span style={{ display: 'flex', flexDirection: 'column', gap: u(2), lineHeight: 1.15 }}>
        <b style={{ fontSize: u(30), color: t.ink }}>{kit.name || 'Your name'}</b>
        {kit.byline ? <small style={{ fontSize: u(24), fontWeight: 500, color: t.dim }}>{kit.byline}</small> : null}
      </span>
    </span>
  )

  const shell: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: `${u(92)} ${u(88)}`, background: t.bg, color: t.ink, fontFamily: fontStack(kit.fonts?.body) }
  const headline = (size: number): CSSProperties => ({ fontFamily: display, fontSize: u(size), fontWeight: 700, lineHeight: 1.04, letterSpacing: '-0.03em', overflowWrap: 'anywhere' })

  return (
    <div className={className} style={{ containerType: 'inline-size' }}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[6px] shadow-[0_1px_2px_rgba(23,23,33,0.12),0_8px_24px_-12px_rgba(23,23,33,0.35)]">
        <div style={shell}>
          {showTop ? <img onError={hide} src={(wordmark || logo)!} alt="" style={{ position: 'absolute', top: u(92), right: u(88), height: u(wordmark ? 52 : 64), maxWidth: u(wordmark ? 380 : 200), objectFit: 'contain' }} /> : null}
          {kind === 'cover' ? (
            <>
              <p style={{ fontSize: u(30), fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.accent, maxWidth: showTop ? '60%' : undefined }}>{sample.kicker}</p>
              <div style={{ flex: 1 }} />
              <p style={headline(sample.cover.length > 48 ? 84 : 104)}>{sample.cover}</p>
              <div style={{ flex: 1 }} />
            </>
          ) : kind === 'point' ? (
            <>
              <div style={{ flex: 1 }} />
              <p style={headline(68)}>{sample.point}</p>
              <p style={{ marginTop: u(36), fontSize: u(40), lineHeight: 1.32, color: t.dim }}>
                {sample.body.split(' ').slice(0, -2).join(' ')} <span style={{ background: t.accent, color: t.markInk, padding: '0 0.14em', borderRadius: '0.12em' }}>{sample.body.split(' ').slice(-2).join(' ')}</span>
              </p>
              <div style={{ flex: 1 }} />
            </>
          ) : (
            <>
              <div style={{ flex: 1 }} />
              {face ? <img onError={hide} src={face} alt="" referrerPolicy="no-referrer" style={{ width: u(180), height: u(180), borderRadius: '50%', objectFit: 'cover', marginBottom: u(48), boxShadow: `0 0 0 ${u(6)} ${t.accent}` }} /> : null}
              <p style={headline(76)}>Found this useful?</p>
              <div style={{ marginTop: u(60), borderRadius: u(34), padding: `${u(46)} ${u(48)}`, background: t.panel, border: `${u(3)} solid ${t.accent}`, display: 'flex', flexDirection: 'column', gap: u(14) }}>
                <p style={{ fontFamily: display, fontSize: u(60), fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em' }}>{cta.action}</p>
                <p style={{ fontSize: u(32), color: t.dim }}>{cta.detail}</p>
              </div>
              <div style={{ flex: 1 }} />
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: u(28), color: t.dim, fontWeight: 600 }}>
            <span style={{ color: t.ink }}>{who}</span>
            <span>{page}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
