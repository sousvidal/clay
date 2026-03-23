import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getIsDark: () => Promise<boolean>
      onThemeChange: (callback: (isDark: boolean) => void) => () => void
    }
  }
}
