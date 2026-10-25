import { motion } from 'motion/react'
import { usePod } from '@/lib/data'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

/** The "Is this you?" card: photo, name, headline, link. */
export function IdentityCard({ name, headline, photo, url, from, small = false }: { name: string; headline?: string | null; photo?: string | null; url?: string | null; from?: string; small?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateX: -12, y: 6 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex items-center rounded-lg bg-night-raised ring-1 ring-white/10', small ? 'gap-4 p-4' : 'gap-5 p-6')}
      style={{ transformPerspective: 800 }}
    >
      {photo ? (
        <img src={photo} alt="" className={cn('shrink-0 rounded-full object-cover', small ? 'size-12' : 'size-16')} referrerPolicy="no-referrer" />
      ) : (
        <div className={cn('grid shrink-0 place-items-center rounded-full bg-periwinkle/20 text-on-dark', small ? 'size-12 text-[18px]' : 'size-16 text-[22px]')}>{name.charAt(0)}</div>
      )}
      <div className="min-w-0">
        <p className={cn('text-on-dark', small ? 'text-[16px]' : 'text-[19px]')} style={{ fontWeight: 480 }}>{name}</p>
        {headline ? <p className={cn('mt-1 text-fog', small ? 'text-[14px]' : 'text-[15px]')}>{headline}</p> : null}
        {url || from ? <p className="mt-2 truncate text-[13px] text-fog/60">{[from, url?.replace(/^https?:\/\/(www\.)?/, '')].filter(Boolean).join(' · ')}</p> : null}
      </div>
    </motion.div>
  )
}

/** Has a background lookup found someone the person hasn't confirmed yet? */
export function usePendingIdentity() {
  const { profile } = usePod()
  const found = !!(profile?.linkedin_name || profile?.headline)
  return { pending: !!profile && !profile.profile_confirmed && found, looking: !!profile && !profile.profile_confirmed && !found && !!profile.linkedin_url }
}

/** Confirm a profile found in the background. "Not me" sends them back to the link. */
export function ConfirmPending({ small = false, onNotMe }: { small?: boolean; onNotMe: () => void }) {
  const { profile, update } = usePod()
  if (!profile) return null
  return (
    <div className={cn('flex flex-col', small ? 'gap-3' : 'gap-5')}>
      <p className={cn('text-on-dark', small ? 'text-[15px]' : 'text-[19px]')} style={{ fontWeight: 460 }}>
        {small ? 'Found you. Is this you?' : 'Is this you?'}
      </p>
      <IdentityCard small={small} name={profile.linkedin_name || 'You'} headline={profile.headline} photo={profile.photo_url} url={profile.linkedin_url} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size={small ? 'sm' : 'lg'} onClick={() => void update('profile', profile.id, { profile_confirmed: true, first_name: profile.first_name || profile.linkedin_name?.split(' ')[0] || null })}>
          That’s me
        </Button>
        <Button variant="quiet" size={small ? 'sm' : 'md'} onClick={onNotMe}>
          Not me
        </Button>
      </div>
    </div>
  )
}
