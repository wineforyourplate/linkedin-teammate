/* Lemma's cast: the characters Lemma uses for teammates. The art is served by
   lemma.work, so this app loads it from there instead of bundling it. Each entry
   only says where things sit in the 1254×1254 portrait: the eye centres, the
   tint for the shared arms and feet, and how the body is placed. */

export const ART = 'https://lemma.work/teammates'

export interface CastMember {
  name: string
  color: string
  /** Tint for the feet when the body colour would look wrong on a leg. */
  foot?: string
  /** A wide stance moves the legs apart (a body with a gap under it). */
  wide?: boolean
  /** Raise the right shoulder (it would otherwise sit inside the body). */
  highArm?: boolean
  eyes: [[number, number], [number, number]]
  y: number
  scale: number
  /** How high a happy hop goes, in portrait units. */
  lift: number
}

export const CAST = {
  spool: { name: 'Spool', color: '#e8661f', eyes: [[560, 420], [690, 420]], y: -60, scale: 1, lift: 13 },
  bean: { name: 'Bean', color: '#a880e8', eyes: [[494, 336], [625, 336]], y: -73, scale: 1.05, lift: 6 },
  cloud: { name: 'Cloud', color: '#7aa6f0', eyes: [[570, 451], [689, 451]], y: 64, scale: 0.85, lift: 7 },
  spark: { name: 'Spark', color: '#ffd22d', highArm: true, eyes: [[619, 490], [733, 472]], y: 15, scale: 0.76, lift: 38 },
  coil: { name: 'Coil', color: '#7b83fa', eyes: [[671, 308], [787, 282]], y: 5, scale: 0.8, lift: 27 },
  kite: { name: 'Kite', color: '#fc707e', foot: '#426cf5', eyes: [[677, 430], [790, 455]], y: 45, scale: 0.8, lift: 18 },
  bloom: { name: 'Bloom', color: '#ff707d', foot: '#a47ae8', eyes: [[567, 521], [680, 521]], y: 15, scale: 0.8, lift: 10 },
  knot: { name: 'Knot', color: '#35b6b7', eyes: [[572, 467], [690, 447]], y: 65, scale: 0.8, lift: 10 },
  arch: { name: 'Arch', color: '#ffcf28', wide: true, eyes: [[568, 300], [690, 300]], y: 40, scale: 0.8, lift: 3 },
  stack: { name: 'Stack', color: '#38a98b', eyes: [[576, 381], [700, 375]], y: 60, scale: 0.8, lift: 4 },
  wedge: { name: 'Wedge', color: '#1f9e9e', eyes: [[613, 463], [708, 463]], y: 73, scale: 0.83, lift: 5 },
  bolt: { name: 'Bolt', color: '#f58220', eyes: [[619, 253], [751, 280]], y: -71, scale: 1.08, lift: 30 },
  ring: { name: 'Ring', color: '#d92d63', eyes: [[573, 244], [705, 244]], y: -85, scale: 0.94, lift: 12 },
  sprout: { name: 'Sprout', color: '#4caf3f', eyes: [[584, 588], [687, 588]], y: 63, scale: 0.82, lift: 14 },
  cube: { name: 'Cube', color: '#8b3fd4', eyes: [[573, 560], [685, 560]], y: 64, scale: 0.8, lift: 4 },
  wave: { name: 'Wave', color: '#2f5fe0', eyes: [[701, 353], [834, 353]], y: 27, scale: 1.02, lift: 15 },
  moon: { name: 'Moon', color: '#f5c43a', eyes: [[399, 519], [500, 519]], y: 65, scale: 0.81, lift: 6 },
  prism: { name: 'Prism', color: '#2bb3a6', eyes: [[589, 625], [693, 625]], y: 65, scale: 0.8, lift: 11 },
  grid: { name: 'Grid', color: '#2f7a4a', eyes: [[551, 374], [664, 374]], y: 75, scale: 0.83, lift: 4 },
  peak: { name: 'Peak', color: '#4a7fd4', eyes: [[552, 610], [709, 610]], y: -208, scale: 1.12, lift: 22 },
  gem: { name: 'Gem', color: '#e8318f', eyes: [[619, 550], [814, 550]], y: -163, scale: 1.15, lift: 20 },
} satisfies Record<string, CastMember>

export type CastName = keyof typeof CAST
export const CAST_NAMES = Object.keys(CAST) as CastName[]
