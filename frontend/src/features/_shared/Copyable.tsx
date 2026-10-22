import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

type CopyButtonProps = {
  value: string
  ariaLabel?: string
  className?: string
  iconClassName?: string
  // When set, the toast reads "Copied <toastLabel>" instead of echoing the value
  // — use it for large/multiline payloads where echoing the value is noise.
  toastLabel?: string
}

export function CopyButton({
  value,
  ariaLabel = 'Copy value',
  className,
  iconClassName = 'size-3',
  toastLabel,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(toastLabel ? `Copied ${toastLabel}` : `Copied "${truncate(value, 60)}"`)
      window.setTimeout(() => setCopied(false), 1_200)
    } catch (err) {
      toast.error(`Copy failed: ${String(err)}`)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={ariaLabel}
      className={[
        'rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {copied ? (
        <Check className={`${iconClassName} text-emerald-500`} />
      ) : (
        <Copy className={iconClassName} />
      )}
    </button>
  )
}

type Props = {
  value: string
  children?: ReactNode
  className?: string
}

export function Copyable({ value, children, className }: Props) {
  return (
    <span className={['group inline-flex items-center gap-1', className].filter(Boolean).join(' ')}>
      <span>{children ?? value}</span>
      <CopyButton
        value={value}
        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
    </span>
  )
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}
