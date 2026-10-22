import { formatExpiry, type ExpiryTone } from '@/lib/time'

const EXPIRY_TONE_CLASS: Record<ExpiryTone, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  crit: 'text-destructive font-medium',
  expired: 'text-destructive font-semibold',
}

// ExpiryCell renders a notAfter timestamp as a coloured relative countdown
// ("in 63d" / "expired 3d ago"), with the absolute time on hover.
export function ExpiryCell({ iso }: { iso: string }) {
  const expiry = formatExpiry(iso)
  if (!expiry) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={`text-xs ${EXPIRY_TONE_CLASS[expiry.tone]}`}
      title={new Date(iso).toLocaleString()}
    >
      {expiry.label}
    </span>
  )
}
