import { useState } from 'react'
import { ChevronRight, Brain } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ThinkingBlock } from '../../../lib/types'
import { Markdown } from '../Markdown'

export function ThinkingBlockView({ block }: { block: ThinkingBlock }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((prev) => !prev)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setExpanded((prev) => !prev)
      }}
      className="cursor-pointer rounded-md border border-purple-400/15 bg-purple-500/[0.04] px-2.5 py-1.5 text-[12px] transition-colors hover:bg-purple-500/[0.07] dark:border-purple-400/10 dark:bg-purple-500/[0.06] dark:hover:bg-purple-500/[0.09]"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Brain className="size-3 shrink-0 text-purple-500/70 dark:text-purple-400/70" />
        <span className="font-medium">Thinking</span>
        <ChevronRight
          className={cn(
            'ml-auto size-3 transition-transform duration-100',
            expanded && 'rotate-90',
          )}
        />
      </div>
      {expanded && (
        <div className="mt-1.5 border-t border-purple-500/10 pt-1.5 text-[12px] italic leading-relaxed text-muted-foreground/70">
          <Markdown content={block.text} />
        </div>
      )}
    </div>
  )
}
