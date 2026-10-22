import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { EventsOff, EventsOn } from '@/lib/wails/wailsjs/runtime/runtime'
import { api } from '@/lib/api'
import { installClipboardBindings } from '@/features/_shared/xtermClipboard'
import { scaledFontSize } from '@/features/_shared/useFontScale'
import { xtermThemeFor } from '@/features/_shared/xtermTheme'
import { podShellKey, usePodShells, type PodShellTarget } from '@/store/podShells'
import { useUIStore } from '@/store/ui'

// Pod shells outlive the Exec tab that opened them. Each terminal and its
// backend session live here, outside React, so switching cluster, view or
// resource only takes the terminal off the screen; the Exec tab adopts it
// again when the pod is reopened.

type Entry = {
  term: Terminal
  fit: FitAddon
  host: HTMLDivElement
  sessionId: string | null
  generation: number
  unsubscribe: (() => void) | null
}

const entries = new Map<string, Entry>()

const FONT_FAMILY =
  '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

function createEntry(): Entry {
  // The terminal renders into its own host element, which moves between the
  // page and nowhere; xterm keeps the buffer while it is off-screen.
  const host = document.createElement('div')
  host.style.height = '100%'
  host.style.width = '100%'
  const term = new Terminal({
    cursorBlink: true,
    convertEol: false,
    fontFamily: FONT_FAMILY,
    fontSize: scaledFontSize(12),
    scrollback: 5_000,
    theme: xtermThemeFor(useUIStore.getState().themeId),
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  installClipboardBindings(term)
  const entry: Entry = { term, fit, host, sessionId: null, generation: 0, unsubscribe: null }
  term.onData((data) => {
    if (entry.sessionId) api.sendExecInput(entry.sessionId, data).catch(() => {})
  })
  return entry
}

function endSession(entry: Entry) {
  entry.generation++
  entry.unsubscribe?.()
  entry.unsubscribe = null
  const id = entry.sessionId
  entry.sessionId = null
  if (id) api.stopExec(id).catch(() => {})
}

function resize(entry: Entry) {
  try {
    entry.fit.fit()
  } catch {
    // A hidden host has no size; the next attach or resize refits.
    return
  }
  if (entry.sessionId) api.resizeExec(entry.sessionId, entry.term.cols, entry.term.rows).catch(() => {})
}

export function hasPodShell(key: string): boolean {
  return entries.has(key)
}

export function podShellTerminal(key: string): Terminal | null {
  return entries.get(key)?.term ?? null
}

// startPodShell opens the shell for a target, replacing any session it had.
// start returns the backend session id and defaults to exec'ing target.shell.
export function startPodShell(target: PodShellTarget, banner: string, start?: () => Promise<string>): string {
  const key = podShellKey(target)
  let entry = entries.get(key)
  if (!entry) {
    entry = createEntry()
    entries.set(key, entry)
  }
  endSession(entry)
  const e = entry
  const gen = e.generation
  e.term.reset()
  e.term.writeln(`\x1b[2m# ${banner}\x1b[0m`)
  const { upsert, patch } = usePodShells.getState()
  upsert({ ...target, key, status: 'connecting', startedAt: Date.now(), error: null })
  const run =
    start ?? (() => api.startExec(target.context, target.namespace, target.pod, target.container, [target.shell]))
  run()
    .then((id) => {
      if (gen !== e.generation || entries.get(key) !== e) {
        api.stopExec(id).catch(() => {})
        return
      }
      e.sessionId = id
      const offOut = EventsOn(`exec:out:${id}`, (data: string) => e.term.write(data))
      const offClose = EventsOn(`exec:close:${id}`, (msg: string) => {
        if (e.sessionId !== id) return
        e.sessionId = null
        e.term.writeln(msg ? `\r\n\x1b[31m# session closed: ${msg}\x1b[0m` : `\r\n\x1b[2m# session ended\x1b[0m`)
        usePodShells.getState().patch(key, { status: 'ended', error: msg || null })
      })
      e.unsubscribe = () => {
        offOut?.()
        offClose?.()
        EventsOff(`exec:out:${id}`, `exec:close:${id}`)
      }
      resize(e)
      patch(key, { status: 'running' })
    })
    .catch((err: unknown) => {
      if (gen !== e.generation) return
      e.term.writeln(`\r\n\x1b[31m# ${String(err)}\x1b[0m`)
      usePodShells.getState().patch(key, { status: 'ended', error: String(err) })
    })
  return key
}

// attachPodShell shows the shell's terminal inside container and returns a
// detach function. Detaching keeps the session running.
export function attachPodShell(key: string, container: HTMLElement): () => void {
  const entry = entries.get(key)
  if (!entry) return () => {}
  container.appendChild(entry.host)
  if (!entry.term.element) entry.term.open(entry.host)
  resize(entry)
  const observer = new ResizeObserver(() => resize(entry))
  observer.observe(container)
  return () => {
    observer.disconnect()
    if (entry.host.parentElement === container) container.removeChild(entry.host)
  }
}

export function refitPodShell(key: string) {
  const entry = entries.get(key)
  if (entry) resize(entry)
}

export function stopPodShellSession(key: string) {
  const entry = entries.get(key)
  if (entry) {
    endSession(entry)
    entries.delete(key)
    entry.host.remove()
    entry.term.dispose()
  }
  usePodShells.getState().remove(key)
}

// Theme and font scale apply to every shell, the background ones included.
useUIStore.subscribe((s, prev) => {
  if (s.themeId === prev.themeId && s.fontScale === prev.fontScale) return
  for (const entry of entries.values()) {
    entry.term.options.theme = xtermThemeFor(s.themeId)
    entry.term.options.fontSize = scaledFontSize(12)
    resize(entry)
  }
})
