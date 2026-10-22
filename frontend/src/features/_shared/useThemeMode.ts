import { useUIStore } from '@/store/ui'
import { getTheme } from './themes'

export function useThemeMode(): 'light' | 'dark' {
  const themeId = useUIStore((s) => s.themeId)
  return getTheme(themeId).mode
}
