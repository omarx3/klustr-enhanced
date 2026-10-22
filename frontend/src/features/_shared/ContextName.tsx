import { useContextDisplayName } from '@/store/ui'

// Renders a context under its display name. The kubeconfig name rides in the
// tooltip so a renamed context can still be matched to the kubeconfig entry.
export function ContextName({ name, className }: { name: string; className?: string }) {
  const label = useContextDisplayName(name)
  return (
    <span className={className} title={label === name ? name : `${label} (${name})`}>
      {label}
    </span>
  )
}
