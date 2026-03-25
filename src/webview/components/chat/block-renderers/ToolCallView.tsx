import type { ToolCallBlock } from '../../../lib/types'
import { ToolCallItemView } from './ToolCallItemView'

export function ToolCallView({ block }: { block: ToolCallBlock }): React.JSX.Element {
  return <ToolCallItemView toolCall={block.toolCall} />
}
