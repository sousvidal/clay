import { Info, AlertTriangle } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { SystemMessageBlock } from '../../../lib/types'

export function SystemMessageView({ block }: { block: SystemMessageBlock }): React.JSX.Element {
  const isWarning = block.level === 'warning'
  return (
    <div className="flex items-center gap-3 px-6 py-2">
      <div className="h-px flex-1 bg-border/30" />
      <div
        className={cn(
          'flex items-center gap-1.5 text-[10px]',
          isWarning ? 'text-yellow-500/60' : 'text-muted-foreground/40',
        )}
      >
        {isWarning ? <AlertTriangle className="size-2.5" /> : <Info className="size-2.5" />}
        <span>{block.text}</span>
      </div>
      <div className="h-px flex-1 bg-border/30" />
    </div>
  )
}
