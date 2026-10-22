import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Square, SquareTerminal } from 'lucide-react'
import { api, type JobInfo } from '@/lib/api'
import { onKubeChange } from '@/lib/events'
import { formatAge } from '@/lib/time'
import { useNowTick } from '@/lib/nowTick'
import { ContextName } from '@/features/_shared/ContextName'
import { stopPodShell, usePodShells, type PodShellInfo } from '@/store/podShells'
import { useUIStore } from '@/store/ui'

const JOB_POLL_MS = 15_000

type RunningJob = JobInfo & { contextName: string }

// Running jobs of the active contexts, refreshed on Job changes and a slow
// poll for watches that start late. Inactive contexts have no watch to list
// from, so their jobs show once the user switches back.
function useRunningJobs(contexts: string[]): { jobs: RunningJob[]; error: string | null } {
  const [byContext, setByContext] = useState<Record<string, JobInfo[]>>({})
  const [error, setError] = useState<string | null>(null)
  const key = contexts.join('\n')

  useEffect(() => {
    let cancelled = false
    const load = (ctxs: readonly string[]) => {
      for (const ctx of ctxs) {
        api
          .listJobs(ctx, '')
          .then((list) => {
            if (cancelled) return
            setByContext((prev) => ({ ...prev, [ctx]: (list ?? []).filter((j) => j.status === 'Running') }))
            setError(null)
          })
          .catch((e: unknown) => {
            if (!cancelled) setError(String(e))
          })
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Jobs are scoped to the active contexts.
    setByContext((prev) => Object.fromEntries(contexts.filter((c) => prev[c]).map((c) => [c, prev[c]])))
    load(contexts)
    const timer = window.setInterval(() => load(contexts), JOB_POLL_MS)
    const unsub = onKubeChange('Job', (ctx) => {
      if (contexts.includes(ctx)) load([ctx])
    })
    return () => {
      cancelled = true
      window.clearInterval(timer)
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const jobs = useMemo(
    () =>
      contexts
        .flatMap((contextName) => (byContext[contextName] ?? []).map((j) => ({ ...j, contextName })))
        .sort((a, b) => Date.parse(b.startTime || b.createdAt) - Date.parse(a.startTime || a.createdAt)),
    [contexts, byContext],
  )
  return { jobs, error }
}

// openJobPod lands on the pod a job launched, newest first and a running one
// when there is one. A job with no pod yet opens the job itself.
async function openJobPod(job: RunningJob) {
  const { goToResource } = useUIStore.getState()
  const pods = await api
    .podsForOwner(job.contextName, 'Job', job.namespace, job.name)
    .then((list) => list ?? [])
    .catch(() => [])
  const newest = [...pods].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const pod = newest.find((p) => p.status === 'Running') ?? newest[0]
  if (pod) {
    goToResource('pods', { kind: 'Pod', namespace: pod.namespace, name: pod.name, context: job.contextName }, 'logs')
  } else {
    goToResource('jobs', { kind: 'Job', namespace: job.namespace, name: job.name, context: job.contextName })
  }
}

function openShell(shell: PodShellInfo) {
  useUIStore
    .getState()
    .goToResource('pods', { kind: 'Pod', namespace: shell.namespace, name: shell.pod, context: shell.context }, 'exec')
}

const rowClass =
  'flex w-full cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2 text-left text-xs last:border-0 hover:bg-muted/40'

export function RunningNowSection({ activeContexts }: { activeContexts: string[] }) {
  useNowTick()
  const shellMap = usePodShells((s) => s.shells)
  // Each cluster's Overview lists only its own shells; shells of other
  // clusters keep running and show on their cluster's Overview.
  const shells = useMemo(
    () =>
      Object.values(shellMap)
        .filter((s) => activeContexts.includes(s.context))
        .sort((a, b) => b.startedAt - a.startedAt),
    [shellMap, activeContexts],
  )
  const { jobs, error } = useRunningJobs(activeContexts)
  const multiContext = activeContexts.length > 1

  return (
    <div className="flex flex-col gap-4 px-6 pb-4 @4xl:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <SquareTerminal className="size-3.5 text-emerald-500" aria-hidden />
          <span className="font-medium">Shells: {shells.length}</span>
          <span className="text-muted-foreground">Pod shells keep running when you switch cluster.</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {shells.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No open shells. Open one from a pod&apos;s Exec tab.
            </div>
          ) : (
            shells.map((s) => (
              <div
                key={s.key}
                role="button"
                tabIndex={0}
                aria-label={`Open shell in ${s.pod}`}
                onClick={() => openShell(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openShell(s)
                  }
                }}
                className={rowClass}
              >
                <span
                  aria-label={s.status}
                  title={s.error ?? s.status}
                  className={`size-2 shrink-0 rounded-full ${
                    s.status === 'running'
                      ? 'bg-emerald-500'
                      : s.status === 'connecting'
                        ? 'bg-amber-500'
                        : 'bg-muted-foreground/50'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-foreground">{s.pod}</div>
                  <div className="truncate text-[0.6875rem] text-muted-foreground">
                    {multiContext && (
                      <>
                        <ContextName name={s.context} />
                        {' · '}
                      </>
                    )}
                    {s.namespace} · {s.container} · {s.shell}
                    {s.status === 'ended' && ' · ended'}
                  </div>
                </div>
                <span className="shrink-0 text-muted-foreground">{formatAge(new Date(s.startedAt).toISOString())}</span>
                <button
                  type="button"
                  aria-label={`Stop shell in ${s.pod}`}
                  title="Stop shell"
                  onClick={(e) => {
                    e.stopPropagation()
                    void stopPodShell(s.key)
                  }}
                  className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Square className="size-3" aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <Briefcase className="size-3.5 text-amber-500" aria-hidden />
          <span className="font-medium">Running jobs: {jobs.length}</span>
          {error && <span className="truncate text-muted-foreground">({error})</span>}
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {jobs.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No jobs running.</div>
          ) : (
            jobs.map((j) => (
              <div
                key={`${j.contextName}/${j.namespace}/${j.name}`}
                role="button"
                tabIndex={0}
                aria-label={`Open pod of job ${j.name}`}
                onClick={() => void openJobPod(j)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    void openJobPod(j)
                  }
                }}
                className={rowClass}
              >
                <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-foreground">{j.name}</div>
                  <div className="truncate text-[0.6875rem] text-muted-foreground">
                    {activeContexts.length > 1 && (
                      <>
                        <ContextName name={j.contextName} />
                        {' · '}
                      </>
                    )}
                    {j.namespace} · {j.completions} completed
                  </div>
                </div>
                <span className="shrink-0 text-muted-foreground">
                  {j.startTime ? formatAge(j.startTime) : formatAge(j.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
