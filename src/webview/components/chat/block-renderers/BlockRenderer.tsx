import { MessageCircleQuestion, User } from 'lucide-react'
import type { ContentBlock } from '../../../lib/types'
import { TextBlockView } from './TextBlockView'
import { ThinkingBlockView } from './ThinkingBlockView'
import { ToolCallView } from './ToolCallView'
import { SubAgentView } from './SubAgentView'
import { CompactionView } from './CompactionView'
import { SystemMessageView } from './SystemMessageView'

function AskUserQuestionDisplay({
  input,
  answers,
}: {
  input: Record<string, unknown>
  answers?: Record<string, string>
}): React.JSX.Element {
  const questions = Array.isArray(input.questions)
    ? (input.questions as Array<Record<string, unknown>>)
    : []

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/[0.04] px-2.5 py-2 text-[12px]">
        <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0 text-blue-500/50" />
        <div className="min-w-0 flex-1 space-y-1.5">
          {questions.map((q, i) => {
            const questionText = String(q.question ?? '')
            const answer = answers?.[questionText]
            return (
              <div key={i}>
                <span className="text-foreground/80">{questionText}</span>
                {!answer &&
                  Array.isArray(q.options) &&
                  (q.options as Array<Record<string, unknown>>).length > 0 && (
                    <span className="ml-1.5 text-muted-foreground/50">
                      (
                      {(q.options as Array<Record<string, unknown>>)
                        .map((o) => String(o.label ?? ''))
                        .join(', ')}
                      )
                    </span>
                  )}
              </div>
            )
          })}
        </div>
      </div>
      {answers && Object.keys(answers).length > 0 && (
        <div className="flex justify-end">
          <div className="flex items-center gap-2 rounded-2xl rounded-tr-sm border border-border/40 bg-muted/50 px-3 py-1.5 text-[12px] text-foreground">
            <span>{Object.values(answers).join(', ')}</span>
            <User className="size-3 shrink-0 text-muted-foreground/50" />
          </div>
        </div>
      )}
    </div>
  )
}

export function BlockRenderer({
  block,
  answeredQuestions,
}: {
  block: ContentBlock
  answeredQuestions?: Map<string, Record<string, string>>
}): React.JSX.Element | null {
  switch (block.kind) {
    case 'text':
      return <TextBlockView block={block} />
    case 'thinking':
      return <ThinkingBlockView block={block} />
    case 'tool_call':
      if (block.toolCall.name === 'AskUserQuestion')
        return (
          <AskUserQuestionDisplay
            input={block.toolCall.input}
            answers={answeredQuestions?.get(block.toolCall.id)}
          />
        )
      return <ToolCallView block={block} />
    case 'sub_agent':
      return <SubAgentView block={block} />
    case 'compaction':
      return <CompactionView block={block} />
    case 'system_message':
      return <SystemMessageView block={block} />
    default:
      return null
  }
}
