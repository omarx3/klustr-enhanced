import type { ITheme } from '@xterm/xterm'
import { getTheme, type ThemeId } from './themes'

export function xtermThemeFor(themeId: ThemeId): ITheme {
  return getTheme(themeId).xterm
}
