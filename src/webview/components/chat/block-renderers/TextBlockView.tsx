import type { TextBlock } from '../../../lib/types'
import { Markdown } from '../Markdown'

export function TextBlockView({ block }: { block: TextBlock }): React.JSX.Element {
  return (
    <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-card px-4 py-3 text-[13px] leading-relaxed text-foreground">
      <Markdown content={block.text} />
    </div>
  )
}
