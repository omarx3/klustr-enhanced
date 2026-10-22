import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, CircleX, RotateCcw, Save, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { useContextLabel, useUIStore, type ResourceKind, type SelectedResource } from '@/store/ui'
import { useThemeMode } from '@/features/_shared/useThemeMode'
import { useScaledFontSize } from '@/features/_shared/useFontScale'
import { hasErrors, validateManifest, type ManifestIssue } from './validateManifest'

const Editor = lazy(() => import('@/lib/monaco').then((m) => ({ default: m.Editor })))

export type CreateTarget = {
  contextName: string
  // Real kind for built-ins (e.g. "Service"); the CRD kind for custom resources.
  kind: string
  namespaced: boolean
  template: string
  // Set for custom resources so the created object can be opened.
  gvr?: { group: string; version: string; resource: string }
  // Set when the manifest is a copy of an existing object.
  duplicateOf?: string
  // How to open the created object when the kind alone is not enough: the
  // original row's kind (an alias such as FluxKustomization) and gvr.
  openAs?: Pick<SelectedResource, 'kind' | 'gvr'>
}

type Props = {
  target: CreateTarget
  onClose: () => void
}

// The slice of the Monaco API this dialog uses. Monaco itself may only be
// imported through @/lib/monaco (lazily), so the shapes are declared here.
type EditorModel = { getLineCount(): number; getLineMaxColumn(line: number): number }
type CodeEditor = {
  getModel(): EditorModel | null
  revealLineInCenter(line: number): void
  setPosition(p: { lineNumber: number; column: number }): void
  focus(): void
}
type Marker = {
  severity: number
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}
type MonacoApi = {
  MarkerSeverity: { Error: number; Warning: number }
  editor: { setModelMarkers(model: EditorModel, owner: string, markers: Marker[]): void }
}

// Same summarizing as the YAML tab: "invalid" errors echo the whole object.
function summarize(raw: string): string {
  return raw.replace(/\{.*\}/s, '{…}').replace(/\s+/g, ' ').trim()
}

export function CreateResourceDialog({ target, onClose }: Props) {
  const theme = useThemeMode()
  const editorFontSize = useScaledFontSize(12)
  const readOnly = useUIStore((s) => s.globalReadOnly)
  const openResource = useUIStore((s) => s.openResource)
  const labelOf = useContextLabel()
  const [text, setText] = useState(target.template)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmWarnings, setConfirmWarnings] = useState(false)
  const editorRef = useRef<CodeEditor | null>(null)
  const monacoRef = useRef<MonacoApi | null>(null)
  const [mounted, setMounted] = useState(0)

  const result = useMemo(
    () => validateManifest(text, { expectedKind: target.kind, namespaced: target.namespaced }),
    [text, target.kind, target.namespaced],
  )
  const errors = result.issues.filter((i) => i.severity === 'error')
  const warnings = result.issues.filter((i) => i.severity === 'warning')
  const dirty = text !== target.template

  // Squiggles in the editor for every issue, so the line is obvious.
  useEffect(() => {
    const monaco = monacoRef.current
    const model = editorRef.current?.getModel()
    if (!monaco || !model) return
    monaco.editor.setModelMarkers(
      model,
      'klustr-manifest',
      result.issues.map((i) => {
        const line = Math.max(1, Math.min(i.line || 1, model.getLineCount()))
        const col = Math.max(1, i.column || 1)
        return {
          severity: i.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
          message: i.message,
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: Math.max(col + 1, model.getLineMaxColumn(line)),
        }
      }),
    )
  }, [result.issues, mounted])

  // Any edit invalidates a previous server answer and the warning confirmation.
  const edit = (next: string) => {
    setText(next)
    setServerError(null)
    setConfirmWarnings(false)
  }

  const save = useMutation({
    mutationFn: async (manifest: string) => {
      // Dry run first: schema, admission and quota errors come back without
      // anything being written.
      await api.createResourceYAML(target.contextName, manifest, true)
      return api.createResourceYAML(target.contextName, manifest, false)
    },
    onSuccess: (created) => {
      const where = created.namespace ? ` in ${created.namespace}` : ''
      toast.success(`Created ${created.kind.toLowerCase()}/${created.name}${where}`)
      onClose()
      if (target.openAs) {
        openResource({
          ...target.openAs,
          namespace: created.namespace,
          name: created.name,
          context: target.contextName,
        })
        return
      }
      openResource({
        kind: (target.gvr ? `cr:${target.gvr.group}/${target.gvr.resource}` : created.kind) as ResourceKind,
        namespace: created.namespace,
        name: created.name,
        context: target.contextName,
        ...(target.gvr ? { gvr: target.gvr } : {}),
      })
    },
    onError: (e) => setServerError(String(e)),
  })

  const format = () => {
    if (result.formatted !== null && result.formatted !== text) edit(result.formatted)
  }

  const onSave = () => {
    if (hasErrors(result) || result.formatted === null) {
      jumpTo(errors[0])
      return
    }
    if (warnings.length > 0 && !confirmWarnings) {
      setConfirmWarnings(true)
      return
    }
    // Saved text is always the normalized form, so what lands in the cluster
    // and what the editor shows are identically indented.
    if (result.formatted !== text) setText(result.formatted)
    save.mutate(result.formatted)
  }

  const jumpTo = (issue: ManifestIssue | undefined) => {
    const ed = editorRef.current
    if (!ed || !issue || !issue.line) return
    ed.revealLineInCenter(issue.line)
    ed.setPosition({ lineNumber: issue.line, column: Math.max(1, issue.column) })
    ed.focus()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (o || save.isPending) return
        if (dirty && !window.confirm('Discard this new manifest?')) return
        onClose()
      }}
    >
      <DialogContent
        className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault()
            onSave()
          }
        }}
      >
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle>{target.duplicateOf ? `Duplicate ${target.kind}` : `Create ${target.kind}`}</DialogTitle>
          <DialogDescription>
            {target.duplicateOf ? (
              <>
                A copy of <span className="font-mono text-foreground">{target.duplicateOf}</span>. Edit it, then save to
                create it in
              </>
            ) : (
              'Edit the manifest, then save to create it in'
            )}{' '}
            <span className="font-medium text-foreground">{labelOf(target.contextName)}</span>. Indentation is normalized
            to 2 spaces on save; errors must be fixed first.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading editor…</div>
            }
          >
            <Editor
              height="100%"
              language="yaml"
              value={text}
              onChange={(v) => edit(v ?? '')}
              onMount={(ed, monaco) => {
                editorRef.current = ed as unknown as CodeEditor
                monacoRef.current = monaco as unknown as MonacoApi
                ed.focus()
                // The marker effect needs the model, which exists only now.
                setMounted((n) => n + 1)
              }}
              theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
              options={{
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                folding: true,
                fontSize: editorFontSize,
                fontFamily:
                  '"JetBrains Mono", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                tabSize: 2,
                insertSpaces: true,
                detectIndentation: false,
                renderWhitespace: 'boundary',
                automaticLayout: true,
              }}
            />
          </Suspense>
        </div>

        <div
          aria-label="Manifest problems"
          className="max-h-40 shrink-0 overflow-y-auto border-t border-border px-5 py-2 text-xs"
        >
          {result.issues.length === 0 && !serverError ? (
            <p className="text-emerald-600 dark:text-emerald-400">No problems found.</p>
          ) : (
            <ul className="space-y-1">
              {result.issues.map((i, n) => (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    className={`flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted ${
                      i.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {i.severity === 'error' ? (
                      <CircleX className="mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    )}
                    {i.line > 0 && <span className="shrink-0 font-mono text-muted-foreground">Ln {i.line}</span>}
                    <span>{i.message}</span>
                  </button>
                </li>
              ))}
              {serverError && (
                <li className="flex items-start gap-1.5 px-1 py-0.5 text-destructive">
                  <CircleX className="mt-0.5 size-3.5 shrink-0" />
                  <span className="break-words">
                    <span className="font-medium">Rejected by the cluster: </span>
                    {summarize(serverError)}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>

        {confirmWarnings && (
          <div
            role="alert"
            className="border-t border-amber-500/40 bg-amber-500/10 px-5 py-2 text-xs text-amber-800 dark:text-amber-300"
          >
            There {warnings.length === 1 ? 'is 1 warning' : `are ${warnings.length} warnings`} above. Press Save again to
            create anyway.
          </div>
        )}

        <DialogFooter className="items-center border-t border-border px-5 py-3 sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => edit(target.template)}
              disabled={!dirty || save.isPending}
            >
              <RotateCcw />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={format}
              disabled={result.formatted === null || result.formatted === text || save.isPending}
              title={result.formatted === null ? 'Fix the YAML errors first' : 'Re-indent with 2 spaces'}
            >
              <WandSparkles />
              Format
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {errors.length > 0 && (
              <span className="text-xs text-destructive">
                {errors.length} error{errors.length === 1 ? '' : 's'}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={readOnly || save.isPending || errors.length > 0}
              title={readOnly ? 'Read-only mode is on' : errors.length > 0 ? 'Fix the errors first' : 'Save and apply (Ctrl+S)'}
            >
              {save.isPending ? <Spinner size="sm" /> : <Save />}
              {save.isPending ? 'Saving…' : confirmWarnings ? 'Save anyway' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
