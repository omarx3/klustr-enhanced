import { cn } from '@/lib/utils'
import { useContextDisplayName } from '@/store/ui'

type Props = {
  contextName: string | null
  label?: string
  className?: string
}

export function ContextBadge({ contextName, label = 'Context', className }: Props) {
  const displayName = useContextDisplayName(contextName)
  if (!contextName) return null

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[0.625rem]',
        className,
      )}
      title={
        displayName !== contextName
          ? `${label}: ${displayName} (${contextName})`
          : `${label}: ${contextName}`
      }
    >
      <span className="shrink-0 uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate font-mono font-medium text-foreground">{displayName}</span>
    </span>
  )
}
