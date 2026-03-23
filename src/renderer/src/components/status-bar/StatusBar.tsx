import { GitBranch, AlertCircle, AlertTriangle, Bell } from 'lucide-react'

function StatusItem({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <button className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-foreground/10">
      {children}
    </button>
  )
}

export function StatusBar(): React.JSX.Element {
  return (
    <div className="flex h-[22px] shrink-0 items-center justify-between border-t border-panel-border bg-statusbar-bg px-1 text-[11px] text-muted-foreground">
      <div className="flex items-center">
        <StatusItem>
          <GitBranch className="size-3" />
          <span>main</span>
        </StatusItem>
        <StatusItem>
          <AlertCircle className="size-3" />
          <span>0</span>
        </StatusItem>
        <StatusItem>
          <AlertTriangle className="size-3" />
          <span>0</span>
        </StatusItem>
      </div>

      <div className="flex items-center">
        <StatusItem>
          <span>Ln 1, Col 1</span>
        </StatusItem>
        <StatusItem>
          <span>Spaces: 2</span>
        </StatusItem>
        <StatusItem>
          <span>UTF-8</span>
        </StatusItem>
        <StatusItem>
          <span>LF</span>
        </StatusItem>
        <StatusItem>
          <span>TypeScript React</span>
        </StatusItem>
        <StatusItem>
          <Bell className="size-3" />
        </StatusItem>
      </div>
    </div>
  )
}
