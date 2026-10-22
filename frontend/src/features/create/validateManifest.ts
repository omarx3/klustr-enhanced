import { isMap, isScalar, parseAllDocuments, type Document } from 'yaml'

type ParsedDoc = Document.Parsed

export type Severity = 'error' | 'warning'

// A problem found before saving. line/column are 1-based and point at the
// offending text so the editor can mark it; 0 means "whole document".
export type ManifestIssue = {
  severity: Severity
  message: string
  line: number
  column: number
}

export type ValidationResult = {
  issues: ManifestIssue[]
  // The manifest re-serialized with 2-space indentation and "- " items
  // indented under their key. null when the YAML does not parse.
  formatted: string | null
  // Identity read from the manifest, when present.
  kind: string | null
  name: string | null
  namespace: string | null
}

export type ValidationTarget = {
  // The kind of the page the editor was opened from; a manifest of another
  // kind is allowed but flagged, since it would not show up on this page.
  expectedKind: string
  namespaced: boolean
}

const DNS_SUBDOMAIN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/

// yaml reports its parse errors with a code; turn the indentation-related ones
// into plain advice instead of parser jargon.
const FRIENDLY: Record<string, string> = {
  TAB_AS_INDENT: 'Tabs cannot be used for indentation. Use spaces.',
  BAD_INDENT: 'Indentation does not line up with the surrounding block.',
  BLOCK_AS_IMPLICIT_KEY: 'Unexpected indentation: this line is indented deeper than the key above it.',
  MULTILINE_IMPLICIT_KEY: 'A key must fit on one line. Check the indentation of this line or the one before it.',
  MISSING_CHAR: 'A ":" or closing quote/bracket is missing.',
  DUPLICATE_KEY: 'This key appears twice in the same mapping.',
  UNEXPECTED_TOKEN: 'Unexpected character. Check indentation and quoting.',
  BAD_DIRECTIVE: 'Unknown YAML directive.',
}

function pos(offset: number | undefined, lineStarts: number[]): { line: number; column: number } {
  if (offset === undefined) return { line: 0, column: 0 }
  let line = 0
  while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) line++
  return { line: line + 1, column: offset - lineStarts[line] + 1 }
}

function lineStartsOf(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}

function scalarString(doc: ParsedDoc, path: string[]): { value: string | null; offset?: number; present: boolean } {
  const node = doc.getIn(path, true)
  if (node === undefined) return { value: null, present: false }
  if (isScalar(node)) {
    const v = node.value
    return {
      value: v === null || v === undefined ? '' : String(v),
      offset: node.range?.[0],
      present: true,
    }
  }
  return { value: null, offset: (node as { range?: number[] }).range?.[0], present: true }
}

export function validateManifest(text: string, target: ValidationTarget): ValidationResult {
  const issues: ManifestIssue[] = []
  const starts = lineStartsOf(text)
  const empty: ValidationResult = { issues, formatted: null, kind: null, name: null, namespace: null }

  // Tabs anywhere in leading whitespace: report every line, not just the first
  // the parser trips over.
  text.split('\n').forEach((l, i) => {
    const lead = /^[ \t]*/.exec(l)?.[0] ?? ''
    if (lead.includes('\t')) {
      issues.push({ severity: 'error', message: FRIENDLY.TAB_AS_INDENT, line: i + 1, column: lead.indexOf('\t') + 1 })
    }
  })

  const docs = parseAllDocuments(text)
  const list = Array.isArray(docs) ? docs : [docs]
  const real = list.filter((d) => d.contents !== null || d.errors.length > 0)
  if (real.length === 0) {
    issues.push({ severity: 'error', message: 'The manifest is empty.', line: 0, column: 0 })
    return empty
  }
  if (real.length > 1) {
    const second = real[1]
    issues.push({
      severity: 'error',
      message: `Found ${real.length} YAML documents. Create one resource at a time.`,
      ...pos(second.range?.[0], starts),
    })
  }
  const doc = real[0]

  for (const e of [...doc.errors, ...doc.warnings]) {
    if (e.code === 'TAB_AS_INDENT' && issues.some((i) => i.message === FRIENDLY.TAB_AS_INDENT)) continue
    const at = e.linePos?.[0]
    const detail = e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '')
    issues.push({
      severity: doc.errors.includes(e as never) ? 'error' : 'warning',
      message: FRIENDLY[e.code] ? `${FRIENDLY[e.code]} (${detail})` : detail,
      line: at?.line ?? 0,
      column: at?.col ?? 0,
    })
  }
  if (doc.errors.length > 0) return { ...empty, issues: dedupe(issues) }

  if (!isMap(doc.contents)) {
    issues.push({ severity: 'error', message: 'The manifest must be a mapping with apiVersion, kind and metadata.', line: 1, column: 1 })
    return { ...empty, issues: dedupe(issues) }
  }

  const apiVersion = scalarString(doc, ['apiVersion'])
  const kind = scalarString(doc, ['kind'])
  const name = scalarString(doc, ['metadata', 'name'])
  const generateName = scalarString(doc, ['metadata', 'generateName'])
  const namespace = scalarString(doc, ['metadata', 'namespace'])
  const metadata = doc.getIn(['metadata'], true)

  if (!apiVersion.value) issues.push({ severity: 'error', message: 'apiVersion is required.', ...pos(apiVersion.offset, starts) })
  if (!kind.value) {
    issues.push({ severity: 'error', message: 'kind is required.', ...pos(kind.offset, starts) })
  } else if (target.expectedKind && kind.value !== target.expectedKind) {
    issues.push({
      severity: 'warning',
      message: `kind is ${kind.value}, but this page lists ${target.expectedKind}. It will be created but will not appear here.`,
      ...pos(kind.offset, starts),
    })
  }
  if (!isMap(metadata)) {
    issues.push({ severity: 'error', message: 'metadata must be a mapping with a name.', ...pos((metadata as { range?: number[] } | undefined)?.range?.[0], starts) })
  } else if (!name.value && !generateName.value) {
    issues.push({ severity: 'error', message: 'metadata.name is required.', ...pos(name.offset ?? metadata.range?.[0], starts) })
  } else if (name.value && name.value.length > 253) {
    issues.push({ severity: 'error', message: 'metadata.name must be 253 characters or fewer.', ...pos(name.offset, starts) })
  } else if (name.value && !DNS_SUBDOMAIN.test(name.value)) {
    issues.push({
      severity: 'warning',
      message: 'metadata.name should use lowercase letters, digits, "-" and "."; most kinds reject other names.',
      ...pos(name.offset, starts),
    })
  }

  if (target.namespaced && namespace.present && !namespace.value) {
    issues.push({ severity: 'error', message: 'metadata.namespace is empty.', ...pos(namespace.offset, starts) })
  } else if (!target.namespaced && namespace.value) {
    issues.push({
      severity: 'warning',
      message: `${target.expectedKind || 'This kind'} is cluster-scoped; metadata.namespace will be ignored.`,
      ...pos(namespace.offset, starts),
    })
  }

  return {
    issues: dedupe(issues),
    formatted: doc.toString({ indent: 2, indentSeq: true, lineWidth: 0, flowCollectionPadding: false }),
    kind: kind.value || null,
    name: name.value || generateName.value || null,
    namespace: namespace.value || null,
  }
}

function dedupe(issues: ManifestIssue[]): ManifestIssue[] {
  const seen = new Set<string>()
  return issues
    .filter((i) => {
      const k = `${i.severity}|${i.line}|${i.column}|${i.message}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => a.line - b.line || a.column - b.column || (a.severity === 'error' ? -1 : 1))
}

export function hasErrors(result: ValidationResult): boolean {
  return result.issues.some((i) => i.severity === 'error')
}
