import { create } from 'zustand'

type ActivityItem = 'files' | 'sessions' | 'search'

interface EditorTab {
  id: string
  label: string
  icon?: string
  modified?: boolean
}

interface LayoutState {
  activeActivityItem: ActivityItem | null
  sidebarVisible: boolean

  editorTabs: EditorTab[]
  activeEditorTab: string

  setActiveActivityItem: (item: ActivityItem) => void
  toggleSidebar: () => void
  setActiveEditorTab: (id: string) => void
  closeEditorTab: (id: string) => void
}

export type { ActivityItem, EditorTab }

export const useLayoutStore = create<LayoutState>()((set, get) => ({
  activeActivityItem: 'files',
  sidebarVisible: true,

  editorTabs: [
    { id: 'welcome', label: 'Welcome' },
    { id: 'app.tsx', label: 'App.tsx', modified: true },
    { id: 'conversation', label: 'Conversation' },
  ],
  activeEditorTab: 'welcome',

  setActiveActivityItem: (item): void => {
    const { activeActivityItem, sidebarVisible } = get()
    if (activeActivityItem === item && sidebarVisible) {
      set({ sidebarVisible: false })
    } else {
      set({ activeActivityItem: item, sidebarVisible: true })
    }
  },

  toggleSidebar: (): void => {
    set((s) => ({ sidebarVisible: !s.sidebarVisible }))
  },

  setActiveEditorTab: (id): void => {
    set({ activeEditorTab: id })
  },

  closeEditorTab: (id): void => {
    const { editorTabs, activeEditorTab } = get()
    const newTabs = editorTabs.filter((t) => t.id !== id)
    if (newTabs.length === 0) return
    if (activeEditorTab === id) {
      const idx = editorTabs.findIndex((t) => t.id === id)
      const newActive = newTabs[Math.min(idx, newTabs.length - 1)]
      set({ editorTabs: newTabs, activeEditorTab: newActive.id })
    } else {
      set({ editorTabs: newTabs })
    }
  },
}))
