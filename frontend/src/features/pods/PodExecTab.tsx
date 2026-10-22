import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Square } from 'lucide-react'
import { toast } from 'sonner'
import '@xterm/xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type PodDetail } from '@/lib/api'
import { InlinePicker } from '@/features/_shared/InlinePicker'
import { TerminalContextMenu } from '@/features/_shared/TerminalContextMenu'
import { TerminalAppPickerDialog } from '@/features/terminal/TerminalAppPickerDialog'
import { podShellKey, usePodShells, type PodShellTarget } from '@/store/podShells'
import { useTerminalStore } from '@/store/terminals'
import { useUIStore } from '@/store/ui'
import {
  attachPodShell,
  hasPodShell,
  podShellTerminal,
  refitPodShell,
  startPodShell,
  stopPodShellSession,
} from './podShellSessions'

const SHELLS = ['/bin/sh', '/bin/bash']
// Tagged, so the kubelet pulls once instead of on every session (an unpinned
// tag implies imagePullPolicy: Always).
const DEBUG_IMAGE_PRESETS = ['nicolaka/netshoot:v0.16', 'busybox:1.38', 'alpine:3.23']
const DEFAULT_DEBUG_IMAGE = DEBUG_IMAGE_PRESETS[0]

type Mode = 'exec' | 'debug'

type Props = {
  detail: PodDetail
  contextName?: string | null
  active: boolean
}

// The shell already open for this container, so reopening the pod shows it
// with the shell it was started with.
function openShellFor(context: string | null, detail: PodDetail, container: string): string | undefined {
  if (!context || !container) return undefined
  const key = podShellKey({ context, namespace: detail.namespace, pod: detail.name, container })
  return usePodShells.getState().shells[key]?.shell
}

export function PodExecTab({ detail, contextName, active }: Props) {
  const fallbackContext = useUIStore((s) => s.selectedContext)
  const selectedContext = contextName ?? fallbackContext
  const containerNames = useMemo(
    () => detail.containers.map((c) => c.name),
    [detail.containers],
  )
  const defaultContainer =
    detail.containers.find((c) => openShellFor(selectedContext, detail, c.name))?.name ??
    detail.containers[0]?.name ??
    ''
  const [mode, setMode] = useState<Mode>('exec')
  const [container, setContainer] = useState(defaultContainer)
  const [shell, setShell] = useState(() => openShellFor(selectedContext, detail, defaultContainer) ?? SHELLS[0])
  const [image, setImage] = useState(DEFAULT_DEBUG_IMAGE)
  const [elevated, setElevated] = useState(false)
  const [externalOpen, setExternalOpen] = useState(false)

  // Seed from a debug container created in an earlier session so Reattach works
  // after a dialog reopen (component state has reset by then) instead of
  // injecting a second, unremovable ephemeral container. Newest wins: ephemeral
  // containers are appended, so the last running klustr-debugger-* is the most
  // recent.
  const [debugContainer, setDebugContainer] = useState<string | null>(() => {
    const existing = (detail.ephemeralContainers ?? []).filter(
      (c) => c.name.startsWith('klustr-debugger-') && c.state === 'Running',
    )
    return existing.length ? existing[existing.length - 1].name : null
  })

  const termHostRef = useRef<HTMLDivElement>(null)
  const key = selectedContext && container
    ? podShellKey({ context: selectedContext, namespace: detail.namespace, pod: detail.name, container })
    : null
  const shellInfo = usePodShells((s) => (key ? s.shells[key] : undefined))
  const running = shellInfo?.status === 'running'
  const busy = shellInfo?.status === 'connecting'
  const error = shellInfo?.error ?? null

  const target = useCallback(
    (): PodShellTarget | null =>
      selectedContext && container
        ? { context: selectedContext, namespace: detail.namespace, pod: detail.name, container, shell }
        : null,
    [selectedContext, detail.namespace, detail.name, container, shell],
  )

  // One shell per container, kept open in the background: leaving the pod or
  // the cluster only takes the terminal off the screen and coming back shows
  // the same session. A shell starts when the container has none yet, or
  // when the user picks another shell or presses Reattach.
  useEffect(() => {
    if (mode !== 'exec') return
    const t = target()
    if (!t || !key) return
    const open = usePodShells.getState().shells[key]
    if (open && hasPodShell(key) && open.shell === t.shell) return
    startPodShell(t, `attaching to ${t.container} (${t.shell})`)
  }, [mode, key, target])

  const startedAt = shellInfo?.startedAt
  useEffect(() => {
    const host = termHostRef.current
    if (!host || !key || startedAt === undefined) return
    const detach = attachPodShell(key, host)
    return detach
  }, [key, startedAt])

  useEffect(() => {
    if (!active || !key || startedAt === undefined) return
    requestAnimationFrame(() => {
      refitPodShell(key)
      podShellTerminal(key)?.focus()
    })
  }, [active, key, startedAt])

  const reattach = () => {
    const t = target()
    if (t) startPodShell(t, `attaching to ${t.container} (${t.shell})`)
  }

  const stop = () => {
    if (key) stopPodShellSession(key)
  }

  const startDebug = () => {
    const t = target()
    if (!t || busy) return
    startPodShell(
      t,
      `starting debug container (${image}, ${shell}${elevated ? ', SYS_PTRACE' : ''}) targeting ${container}`,
      async () => {
        const s = await api.startPodDebug(t.context, t.namespace, t.pod, container, image, shell, elevated)
        setDebugContainer(s.containerName)
        return s.sessionID
      },
    )
  }

  const reattachDebug = () => {
    const t = target()
    if (!t || !debugContainer || busy) return
    startPodShell(t, `reattaching to ${debugContainer} (${shell})`, () =>
      api.startExec(t.context, t.namespace, t.pod, debugContainer, [shell]),
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-xs">
        <InlinePicker
          value={mode}
          options={['exec', 'debug']}
          onChange={(m) => setMode(m as Mode)}
          ariaLabel="Session mode"
          minWidth={90}
        />

        {mode === 'exec' ? (
          <>
            <label className="text-muted-foreground">Container</label>
            <InlinePicker
              value={container}
              options={containerNames}
              onChange={setContainer}
              ariaLabel="Select container"
              minWidth={140}
            />
          </>
        ) : (
          <>
            <label className="text-muted-foreground">Target</label>
            <InlinePicker
              value={container}
              options={containerNames}
              onChange={setContainer}
              ariaLabel="Select target container"
              minWidth={140}
            />
            <label className="ml-2 text-muted-foreground">Image</label>
            <Input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              aria-label="Debug image"
              className="h-6 w-44 text-xs"
            />
            {DEBUG_IMAGE_PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                size="xs"
                variant={image === p ? 'default' : 'outline'}
                onClick={() => setImage(p)}
              >
                {p.split('/').pop()?.split(':')[0]}
              </Button>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                  <Checkbox
                    checked={elevated}
                    onChange={(e) => setElevated((e.target as HTMLInputElement).checked)}
                    aria-label="Add SYS_PTRACE capability"
                  />
                  <span className="underline decoration-dotted underline-offset-2">
                    SYS_PTRACE
                  </span>
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[20rem] text-xs">
                Adds the CAP_SYS_PTRACE capability to the debug container. Without it the
                target's filesystem (/proc/1/root), environment and open files are
                Permission denied even as root — only its process names are visible. It
                also grants read access to the target process's memory, so anything it
                holds in RAM (tokens, keys) is exposed, and the PodSecurity baseline
                policy rejects pods that add it.
              </TooltipContent>
            </Tooltip>
          </>
        )}

        <label className="ml-2 text-muted-foreground">Shell</label>
        <InlinePicker
          value={shell}
          options={SHELLS}
          onChange={setShell}
          ariaLabel="Select shell"
          minWidth={120}
        />

        {mode === 'exec' ? (
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" size="xs" variant="outline" onClick={reattach}>
              Reattach
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={stop}
              disabled={!shellInfo}
              title="End this shell. Shells otherwise keep running when you leave the pod or the cluster."
            >
              <Square className="size-3" />
              Stop
            </Button>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="default"
              onClick={startDebug}
              disabled={!selectedContext || !container || busy}
            >
              {busy ? 'Starting…' : 'Start debug'}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={reattachDebug}
              disabled={!debugContainer || busy}
              title="Exec back into the debug container"
            >
              Reattach
            </Button>
          </div>
        )}

        {mode === 'exec' && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={(e) => {
              if (!selectedContext) return
              const pref = useTerminalStore.getState().preferredAppId
              if (pref && !e.altKey) {
                api
                  .openPodExecInSystemTerminal(
                    selectedContext,
                    detail.namespace,
                    detail.name,
                    container,
                    shell,
                    pref,
                  )
                  .catch((err) => {
                    toast.error('Could not open system terminal', {
                      description: String(err),
                    })
                    setExternalOpen(true)
                  })
                return
              }
              setExternalOpen(true)
            }}
            disabled={!selectedContext || !container}
            title="Open this exec session in a system terminal (Alt+click to choose app)"
          >
            <ExternalLink className="size-3" />
            External
          </Button>
        )}

        <span className={running ? 'text-emerald-500' : 'text-muted-foreground'}>
          {running ? '● running' : '○ idle'}
        </span>
      </div>

      {mode === 'debug' && (
        <div className="border-b border-border bg-muted/40 px-4 py-1.5 text-[0.6875rem] text-muted-foreground">
          Adds an ephemeral debug container to this pod, sharing the target's
          process namespace. Reading the target's filesystem under /proc/1/root
          additionally needs SYS_PTRACE. Ephemeral containers can't be removed —
          it stays until the pod restarts.
        </div>
      )}

      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-mono text-destructive break-words">
          {error}
        </div>
      )}
      <TerminalContextMenu terminal={() => (key ? podShellTerminal(key) : null)}>
        <div ref={termHostRef} className="min-h-0 flex-1 bg-background px-2 py-1" />
      </TerminalContextMenu>

      <TerminalAppPickerDialog
        open={externalOpen}
        description={
          <>
            Open a system terminal already <code>kubectl exec</code>'d into{' '}
            <span className="font-mono text-foreground">
              {detail.namespace}/{detail.name}
            </span>
            {container && (
              <>
                {' '}container{' '}
                <span className="font-mono text-foreground">{container}</span>
              </>
            )}
            .
          </>
        }
        onClose={() => setExternalOpen(false)}
        onLaunch={(appID) =>
          selectedContext
            ? api.openPodExecInSystemTerminal(
                selectedContext,
                detail.namespace,
                detail.name,
                container,
                shell,
                appID,
              )
            : Promise.resolve()
        }
      />
    </div>
  )
}
