import type { ContentBlock } from '../../../lib/types'
import { TextBlockView } from './TextBlockView'
import { ThinkingBlockView } from './ThinkingBlockView'
import { ToolCallView } from './ToolCallView'
import { SubAgentView } from './SubAgentView'
import { CompactionView } from './CompactionView'
import { SystemMessageView } from './SystemMessageView'

export function BlockRenderer({ block }: { block: ContentBlock }): React.JSX.Element | null {
  switch (block.kind) {
    case 'text':
      return <TextBlockView block={block} />
    case 'thinking':
      return <ThinkingBlockView block={block} />
    case 'tool_call':
      return <ToolCallView block={block} />
    case 'sub_agent':
      return <SubAgentView block={block} />
    case 'compaction':
      return <CompactionView block={block} />
    case 'system_message':
      return <SystemMessageView block={block} />
    case 'user_question':
      // Rendered exclusively in the bottom panel (Conversation.tsx), not inline.
      return null
    default:
      return null
  }
}
