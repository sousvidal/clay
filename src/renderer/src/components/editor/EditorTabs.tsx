import { X, Circle } from 'lucide-react'
import { useLayoutStore } from '@/stores/layout'
import { cn } from '@/lib/utils'

export function EditorTabs(): React.JSX.Element {
  const tabs = useLayoutStore((s) => s.editorTabs)
  const activeTab = useLayoutStore((s) => s.activeEditorTab)
  const setActiveTab = useLayoutStore((s) => s.setActiveEditorTab)
  const closeTab = useLayoutStore((s) => s.closeEditorTab)

  return (
    <div className="flex h-[35px] shrink-0 items-end bg-tab-inactive-bg">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'group relative flex h-[35px] items-center gap-1.5 border-r border-panel-border px-3 text-[13px] transition-colors',
              isActive
                ? 'bg-tab-active-bg text-foreground'
                : 'text-muted-foreground hover:bg-tab-active-bg/50 hover:text-foreground',
            )}
          >
            {isActive && <div className="absolute left-0 right-0 top-0 h-[1px] bg-blue-400" />}
            <span className="max-w-[120px] truncate">{tab.label}</span>
            <span
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              className={cn(
                'flex size-4 items-center justify-center rounded-sm transition-all',
                tab.modified && !isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                'hover:bg-accent',
              )}
            >
              {tab.modified ? (
                <span className="group-hover:hidden">
                  <Circle className="size-2.5 fill-muted-foreground text-muted-foreground" />
                </span>
              ) : null}
              <span className={tab.modified ? 'hidden group-hover:inline-flex' : 'inline-flex'}>
                <X className="size-3" />
              </span>
            </span>
          </button>
        )
      })}
      <div className="flex-1 border-b border-panel-border" />
    </div>
  )
}
