import { ChevronRight } from 'lucide-react'

export function TitleBar(): React.JSX.Element {
  return (
    <div className="flex h-[38px] shrink-0 items-center border-b border-panel-border bg-sidebar-bg [-webkit-app-region:drag]">
      <div className="w-[78px] shrink-0" />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">my-project</span>
        <ChevronRight className="size-3 text-muted-foreground/50" />
        <span>src</span>
        <ChevronRight className="size-3 text-muted-foreground/50" />
        <span>components</span>
        <ChevronRight className="size-3 text-muted-foreground/50" />
        <span className="text-foreground/70">App.tsx</span>
      </div>
    </div>
  )
}
