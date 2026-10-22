// localStorage I/O and theme DOM side effects for the UI store. Every
// persisted concern exposes a `read*` helper (called once at store boot)
// and, where the store mutates beyond initial load, a `persist*` helper
// the store action calls explicitly. Keeping these in one place means the
// store body deals only in pure state transitions.

import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEME_CSS_CLASSES,
  isThemeId,
  type ThemeDefinition,
  type ThemeId,
} from '@/features/_shared/themes'
import {
  MAX_TAGS_PER_CONTEXT,
  DETAIL_WIDTH_DEFAULT,
  DETAIL_WIDTH_MIN,
  DETAIL_WIDTH_MAX,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  type ContextGroup,
  type ContextTag,
  type CustomTagDef,
  type LastSession,
  type SidebarMode,
  type TagColor,
} from './ui.types'

export const THEME_STORAGE_KEY = 'klustr-theme'
export const COLLAPSED_NAV_GROUPS_KEY = 'klustr-collapsed-nav-groups'
export const EXPANDED_CLUSTERS_KEY = 'klustr-expanded-clusters'
export const FAVOURITE_CLUSTERS_KEY = 'klustr-favourite-clusters'
export const EXPANDED_CLUSTER_GROUPS_KEY = 'klustr-expanded-cluster-groups'
export const HIDDEN_SIDEBAR_ITEMS_KEY = 'klustr-hidden-sidebar-items'
export const SIDEBAR_MODE_KEY = 'klustr-sidebar-mode'
export const SIDEBAR_WIDTH_KEY = 'klustr-sidebar-width'
export const DETAIL_WIDTH_KEY = 'klustr-detail-width'
export const DEFAULT_CONTEXT_KEY = 'klustr-default-context'
export const AGGREGATED_CONTEXTS_KEY = 'klustr-aggregated-contexts'
export const NAMESPACES_BY_CONTEXT_KEY = 'klustr-namespaces-by-context'
export const GLOBAL_READ_ONLY_KEY = 'klustr-read-only'
export const CONTEXT_TAGS_KEY = 'klustr-context-tags'
export const CUSTOM_TAGS_KEY = 'klustr-custom-tags'
export const CONTEXT_GROUPS_KEY = 'klustr-context-groups'
export const LAST_SESSION_KEY = 'klustr-last-session'
export const LOG_WRAP_KEY = 'klustr-log-wrap'
export const CONTEXT_DISPLAY_NAMES_KEY = 'klustr-context-display-names'

// Panel widths: whole pixels within bounds, with unreadable values falling
// back to the default.
function clampWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function readWidth(key: string, clamp: (value: number) => number, fallback: number): number {
  const raw = localStorage.getItem(key)
  return raw ? clamp(Number(raw)) : fallback
}

export function clampDetailWidth(value: number): number {
  return clampWidth(value, DETAIL_WIDTH_MIN, DETAIL_WIDTH_MAX, DETAIL_WIDTH_DEFAULT)
}

export function readDetailWidth(): number {
  return readWidth(DETAIL_WIDTH_KEY, clampDetailWidth, DETAIL_WIDTH_DEFAULT)
}

export function persistDetailWidth(value: number) {
  localStorage.setItem(DETAIL_WIDTH_KEY, String(value))
}

const VALID_COLORS: ReadonlySet<TagColor> = new Set([
  'rose',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
  'slate',
])

const VALID_GROUP_COLORS: ReadonlySet<TagColor> = VALID_COLORS

export function isValidGroupColor(c: string): c is TagColor {
  return VALID_GROUP_COLORS.has(c as TagColor)
}

// ---- theme ----------------------------------------------------------------

export function readSavedThemeId(): ThemeId | null {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (isThemeId(saved)) return saved
  if (saved === 'dark') return DEFAULT_DARK
  // Tokyo Night Day was removed; keep its users on a light theme instead of
  // falling back to the OS color scheme.
  if (saved === 'light' || saved === 'tokyo-night-day') return DEFAULT_LIGHT
  return null
}

export function systemThemeId(): ThemeId {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? DEFAULT_DARK : DEFAULT_LIGHT
}

export function applyThemeClasses(theme: ThemeDefinition) {
  const root = document.documentElement
  root.classList.toggle('dark', theme.mode === 'dark')
  for (const cls of THEME_CSS_CLASSES) {
    root.classList.toggle(cls, theme.cssClass === cls)
  }
}

export function persistThemeId(id: ThemeId) {
  localStorage.setItem(THEME_STORAGE_KEY, id)
}

// ---- sidebar --------------------------------------------------------------

export function readSidebarMode(): SidebarMode {
  const raw = localStorage.getItem(SIDEBAR_MODE_KEY)
  return raw === 'expanded' ? 'expanded' : 'icons'
}

export function persistSidebarMode(mode: SidebarMode) {
  localStorage.setItem(SIDEBAR_MODE_KEY, mode)
}

export const HOME_LAYOUT_KEY = 'klustr-home-layout'
export type HomeLayout = 'grid' | 'list'

export function readHomeLayout(): HomeLayout {
  return localStorage.getItem(HOME_LAYOUT_KEY) === 'list' ? 'list' : 'grid'
}

export function persistHomeLayout(layout: HomeLayout) {
  if (layout === 'grid') localStorage.removeItem(HOME_LAYOUT_KEY)
  else localStorage.setItem(HOME_LAYOUT_KEY, layout)
}

export function clampSidebarWidth(value: number): number {
  return clampWidth(value, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_DEFAULT)
}

export function readSidebarWidth(): number {
  return readWidth(SIDEBAR_WIDTH_KEY, clampSidebarWidth, SIDEBAR_WIDTH_DEFAULT)
}

export function persistSidebarWidth(px: number) {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(px))
}

// ---- nav-group collapse state --------------------------------------------

function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function readCollapsedNavGroups(): string[] {
  return readStringArray(COLLAPSED_NAV_GROUPS_KEY)
}

export function persistCollapsedNavGroups(list: string[]) {
  localStorage.setItem(COLLAPSED_NAV_GROUPS_KEY, JSON.stringify(list))
}

export function readExpandedClusters(): string[] {
  return readStringArray(EXPANDED_CLUSTERS_KEY)
}

export function persistExpandedClusters(list: string[]) {
  if (list.length === 0) localStorage.removeItem(EXPANDED_CLUSTERS_KEY)
  else localStorage.setItem(EXPANDED_CLUSTERS_KEY, JSON.stringify(list))
}

export function readFavouriteClusters(): string[] {
  return readStringArray(FAVOURITE_CLUSTERS_KEY)
}

export function persistFavouriteClusters(list: string[]) {
  if (list.length === 0) localStorage.removeItem(FAVOURITE_CLUSTERS_KEY)
  else localStorage.setItem(FAVOURITE_CLUSTERS_KEY, JSON.stringify(list))
}

// Key of a resource group inside one cluster's sidebar tree. The newline
// separator lets forgetContext drop a cluster's keys by prefix; kubeconfig
// context names in practice never contain one.
export function clusterGroupKey(context: string, label: string): string {
  return `${context}\n${label}`
}

export function readExpandedClusterGroups(): string[] {
  return readStringArray(EXPANDED_CLUSTER_GROUPS_KEY)
}

export function persistExpandedClusterGroups(list: string[]) {
  if (list.length === 0) localStorage.removeItem(EXPANDED_CLUSTER_GROUPS_KEY)
  else localStorage.setItem(EXPANDED_CLUSTER_GROUPS_KEY, JSON.stringify(list))
}

export function readHiddenSidebarItemsByContext(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(HIDDEN_SIDEBAR_ITEMS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string[]> = {}
    for (const [ctx, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      const list = value.filter((v): v is string => typeof v === 'string')
      if (list.length > 0) result[ctx] = list
    }
    return result
  } catch {
    return {}
  }
}

export function persistHiddenSidebarItemsByContext(map: Record<string, string[]>) {
  const entries = Object.entries(map).filter(([, list]) => list.length > 0)
  if (entries.length === 0) {
    localStorage.removeItem(HIDDEN_SIDEBAR_ITEMS_KEY)
  } else {
    localStorage.setItem(HIDDEN_SIDEBAR_ITEMS_KEY, JSON.stringify(Object.fromEntries(entries)))
  }
}

// ---- context selection ---------------------------------------------------

export function readDefaultContext(): string | null {
  const v = localStorage.getItem(DEFAULT_CONTEXT_KEY)
  return v && v.length > 0 ? v : null
}

export function persistDefaultContext(name: string | null) {
  if (name && name.length > 0) {
    localStorage.setItem(DEFAULT_CONTEXT_KEY, name)
  } else {
    localStorage.removeItem(DEFAULT_CONTEXT_KEY)
  }
}

export function readAggregatedContexts(): string[] {
  return readStringArray(AGGREGATED_CONTEXTS_KEY)
}

export function persistAggregatedContexts(list: string[]) {
  if (list.length === 0) {
    localStorage.removeItem(AGGREGATED_CONTEXTS_KEY)
  } else {
    localStorage.setItem(AGGREGATED_CONTEXTS_KEY, JSON.stringify(list))
  }
}

// Namespace selection is remembered per active-context-set: the key is the
// sorted active contexts joined (a single context's name in single-context
// mode), so each cluster — and each saved multi-cluster set — keeps its own
// namespace filter. An absent/empty entry means "all namespaces".
export function readNamespacesByContext(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(NAMESPACES_BY_CONTEXT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      const list = value.filter((v): v is string => typeof v === 'string')
      if (list.length > 0) result[key] = list
    }
    return result
  } catch {
    return {}
  }
}

export function readGlobalReadOnly(): boolean {
  return localStorage.getItem(GLOBAL_READ_ONLY_KEY) === 'true'
}

export function persistGlobalReadOnly(value: boolean) {
  if (value) localStorage.setItem(GLOBAL_READ_ONLY_KEY, 'true')
  else localStorage.removeItem(GLOBAL_READ_ONLY_KEY)
}

export function readLogWrap(): boolean {
  return localStorage.getItem(LOG_WRAP_KEY) !== 'false'
}

export function persistLogWrap(value: boolean) {
  if (value) localStorage.removeItem(LOG_WRAP_KEY)
  else localStorage.setItem(LOG_WRAP_KEY, 'false')
}

export function persistNamespacesByContext(map: Record<string, string[]>) {
  const entries = Object.entries(map).filter(([, list]) => list.length > 0)
  if (entries.length === 0) {
    localStorage.removeItem(NAMESPACES_BY_CONTEXT_KEY)
  } else {
    localStorage.setItem(NAMESPACES_BY_CONTEXT_KEY, JSON.stringify(Object.fromEntries(entries)))
  }
}

// ---- last session --------------------------------------------------------

export function readLastSession(): LastSession | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Partial<LastSession>
    if (!Array.isArray(o.contexts)) return null
    const contexts = o.contexts.filter((c): c is string => typeof c === 'string' && c.length > 0)
    if (contexts.length === 0) return null
    const groupId = typeof o.groupId === 'string' && o.groupId.length > 0 ? o.groupId : null
    const at = typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : Date.now()
    return { contexts, groupId, at }
  } catch {
    return null
  }
}

export function persistLastSession(session: LastSession | null) {
  if (!session || session.contexts.length === 0) {
    localStorage.removeItem(LAST_SESSION_KEY)
  } else {
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session))
  }
}

// ---- context groups ------------------------------------------------------

export function readContextGroups(): ContextGroup[] {
  try {
    const raw = localStorage.getItem(CONTEXT_GROUPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: ContextGroup[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const g = item as Partial<ContextGroup>
      if (typeof g.id !== 'string' || typeof g.name !== 'string') continue
      if (!Array.isArray(g.contexts)) continue
      const contexts = g.contexts.filter((c): c is string => typeof c === 'string' && c.length > 0)
      if (g.id.length === 0 || g.name.length === 0) continue
      const color = typeof g.color === 'string' && isValidGroupColor(g.color) ? g.color : 'sky'
      out.push({ id: g.id, name: g.name, contexts, color })
    }
    return out
  } catch {
    return []
  }
}

export function persistContextGroups(list: ContextGroup[]) {
  if (list.length === 0) {
    localStorage.removeItem(CONTEXT_GROUPS_KEY)
  } else {
    localStorage.setItem(CONTEXT_GROUPS_KEY, JSON.stringify(list))
  }
}

// ---- context display names ----------------------------------------------

// Keyed by the kubeconfig context name, which stays the identity everywhere
// else. Only real overrides are stored: blank values are dropped on read so a
// hand-edited entry cannot hide a context behind an empty label.
export function readContextDisplayNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTEXT_DISPLAY_NAMES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'string') continue
      const name = v.trim()
      if (name.length > 0 && name !== k) result[k] = name
    }
    return result
  } catch {
    return {}
  }
}

export function persistContextDisplayNames(map: Record<string, string>) {
  if (Object.keys(map).length === 0) localStorage.removeItem(CONTEXT_DISPLAY_NAMES_KEY)
  else localStorage.setItem(CONTEXT_DISPLAY_NAMES_KEY, JSON.stringify(map))
}

// ---- context tags --------------------------------------------------------

export function readContextTags(): Record<string, ContextTag[]> {
  try {
    const raw = localStorage.getItem(CONTEXT_TAGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, ContextTag[]> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) {
        result[k] = [v]
      } else if (Array.isArray(v)) {
        const ids = v
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
          .slice(0, MAX_TAGS_PER_CONTEXT)
        if (ids.length > 0) result[k] = ids
      }
    }
    return result
  } catch {
    return {}
  }
}

export function persistContextTags(map: Record<string, ContextTag[]>) {
  localStorage.setItem(CONTEXT_TAGS_KEY, JSON.stringify(map))
}

export function readCustomTags(): Record<string, CustomTagDef> {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, CustomTagDef> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue
      const def = v as Partial<CustomTagDef>
      if (
        typeof def.id === 'string' &&
        typeof def.label === 'string' &&
        typeof def.shortLabel === 'string' &&
        typeof def.color === 'string' &&
        VALID_COLORS.has(def.color as TagColor)
      ) {
        result[k] = {
          id: def.id,
          label: def.label,
          shortLabel: def.shortLabel,
          color: def.color as TagColor,
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

export function persistCustomTags(map: Record<string, CustomTagDef>) {
  localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(map))
}

// ---- font scale -------------------------------------------------------------

export const FONT_SCALE_KEY = 'klustr-font-scale'
// Ctrl+= / Ctrl+- step through these; 1 is the default 16px root size.
export const FONT_SCALE_STEPS = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const
export const FONT_SCALE_DEFAULT = 1

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return FONT_SCALE_DEFAULT
  // Snap to the nearest step so a hand-edited value cannot leave the ladder.
  return FONT_SCALE_STEPS.reduce((best, s) => (Math.abs(s - value) < Math.abs(best - value) ? s : best), FONT_SCALE_DEFAULT)
}

export function readFontScale(): number {
  const raw = localStorage.getItem(FONT_SCALE_KEY)
  return raw === null ? FONT_SCALE_DEFAULT : clampFontScale(Number(raw))
}

export function persistFontScale(scale: number) {
  if (scale === FONT_SCALE_DEFAULT) localStorage.removeItem(FONT_SCALE_KEY)
  else localStorage.setItem(FONT_SCALE_KEY, String(scale))
}

// Every rem in the UI (Tailwind text, spacing and sizes) follows the root
// font size, so scaling it zooms the whole interface evenly.
export function applyFontScale(scale: number) {
  document.documentElement.style.fontSize = scale === FONT_SCALE_DEFAULT ? '' : `${scale * 100}%`
}

export function steppedFontScale(current: number, direction: 1 | -1): number {
  const i = FONT_SCALE_STEPS.indexOf(clampFontScale(current) as (typeof FONT_SCALE_STEPS)[number])
  const next = Math.max(0, Math.min(FONT_SCALE_STEPS.length - 1, i + direction))
  return FONT_SCALE_STEPS[next]
}
