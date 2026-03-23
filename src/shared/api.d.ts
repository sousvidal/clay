interface Window {
  api: {
    getIsDark: () => Promise<boolean>
    onThemeChange: (callback: (isDark: boolean) => void) => () => void
  }
}
