import { Files, MessagesSquare, Search, Settings } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLayoutStore } from '@/stores/layout'
import type { ActivityItem } from '@/stores/layout'
import { cn } from '@/lib/utils'

interface ActivityButtonProps {
  item: ActivityItem
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function ActivityButton({ icon, label, active, onClick }: ActivityButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'relative flex h-[48px] w-full items-center justify-center text-muted-foreground/60 transition-colors [-webkit-app-region:no-drag]',
            'hover:bg-accent/40 hover:text-muted-foreground',
            active && 'text-foreground hover:text-foreground',
          )}
        >
          {active && (
            <div className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r-full bg-foreground" />
          )}
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ActivityBar(): React.JSX.Element {
  const activeItem = useLayoutStore((s) => s.activeActivityItem)
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible)
  const setActiveActivityItem = useLayoutStore((s) => s.setActiveActivityItem)

  const isActive = (item: ActivityItem): boolean => activeItem === item && sidebarVisible

  return (
    <div className="flex h-full w-[48px] shrink-0 flex-col border-r border-panel-border bg-activity-bar-bg">
      <ActivityButton
        item="files"
        icon={<Files className="size-[20px]" />}
        label="Explorer"
        active={isActive('files')}
        onClick={() => setActiveActivityItem('files')}
      />
      <ActivityButton
        item="sessions"
        icon={<MessagesSquare className="size-[20px]" />}
        label="Sessions"
        active={isActive('sessions')}
        onClick={() => setActiveActivityItem('sessions')}
      />
      <ActivityButton
        item="search"
        icon={<Search className="size-[20px]" />}
        label="Search"
        active={isActive('search')}
        onClick={() => setActiveActivityItem('search')}
      />

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button className="flex h-[48px] w-full items-center justify-center text-muted-foreground/60 transition-colors hover:bg-accent/40 hover:text-muted-foreground [-webkit-app-region:no-drag]">
            <Settings className="size-[20px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Settings
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
