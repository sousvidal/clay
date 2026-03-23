import { FilePlus, FolderPlus, ChevronsDownUp, Search, RefreshCw } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLayoutStore } from '@/stores/layout'
import { FileTree } from './FileTree'
import { SessionList } from './SessionList'
import { cn } from '@/lib/utils'

function SidebarHeaderAction({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}): React.JSX.Element {
  return (
    <button
      title={label}
      className="flex size-5 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/header:opacity-100"
    >
      {icon}
    </button>
  )
}

function SearchPanel(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="group/header flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </span>
      </div>
      <div className="space-y-2 px-3">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5">
          <span className="flex-1 text-[13px] text-muted-foreground">Replace</span>
        </div>
      </div>
    </div>
  )
}

export function Sidebar(): React.JSX.Element {
  const activeItem = useLayoutStore((s) => s.activeActivityItem)

  return (
    <div className={cn('flex h-full flex-col bg-sidebar-bg')}>
      {activeItem === 'search' ? (
        <SearchPanel />
      ) : activeItem === 'sessions' ? (
        <SessionList />
      ) : (
        <>
          <div className="group/header flex items-center justify-between px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Explorer
            </span>
            <div className="flex items-center gap-0.5">
              <SidebarHeaderAction icon={<FilePlus className="size-3.5" />} label="New File" />
              <SidebarHeaderAction icon={<FolderPlus className="size-3.5" />} label="New Folder" />
              <SidebarHeaderAction
                icon={<RefreshCw className="size-3" />}
                label="Refresh Explorer"
              />
              <SidebarHeaderAction
                icon={<ChevronsDownUp className="size-3.5" />}
                label="Collapse All"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <FileTree />
          </ScrollArea>
        </>
      )}
    </div>
  )
}
