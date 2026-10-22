import { useEffect, useState } from 'react'
import { api, type ContextInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'

// Contexts of the merged kubeconfig, re-listed when the backend reports a
// kubeconfig change (shell-env import, a deleted context).
export function useKubeContexts(): ContextInfo[] {
  const [contexts, setContexts] = useState<ContextInfo[]>([])
  useEffect(() => {
    let cancelled = false
    const load = () => {
      api
        .listContexts()
        .then((cfg) => {
          if (!cancelled) setContexts(cfg.contexts ?? [])
        })
        .catch(() => {})
    }
    load()
    const unsub = onKubeChange('_contexts', load)
    return () => {
      cancelled = true
      unsub()
    }
  }, [])
  return contexts
}
