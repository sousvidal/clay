import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getIsDark: (): Promise<boolean> => ipcRenderer.invoke('theme:get-dark'),
  onThemeChange: (callback: (isDark: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isDark: boolean): void => {
      callback(isDark)
    }
    ipcRenderer.on('theme:changed', handler)
    return () => {
      ipcRenderer.removeListener('theme:changed', handler)
    }
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error defined in .d.ts
  window.electron = electronAPI
  // @ts-expect-error defined in .d.ts
  window.api = api
}
