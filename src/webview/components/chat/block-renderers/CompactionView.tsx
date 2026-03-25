import { Minimize2 } from 'lucide-react'
import type { CompactionBlock } from '../../../lib/types'

export function CompactionView({ block }: { block: CompactionBlock }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-6 py-2">
      <div className="h-px flex-1 bg-border/30" />
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
        <Minimize2 className="size-2.5" />
        <span>{block.summary}</span>
      </div>
      <div className="h-px flex-1 bg-border/30" />
    </div>
  )
}
