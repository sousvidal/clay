import { useState } from 'react'
import { ChevronRight, Layers, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { SubAgentBlock } from '../../../lib/types'
import { Markdown } from '../Markdown'
import { ToolCallItemView } from './ToolCallItemView'

export function SubAgentView({ block }: { block: SubAgentBlock }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { messages, isBackground } = block

  const firstAgent = messages[0]
  const label =
    firstAgent?.agentName ??
    firstAgent?.subagentType ??
    (isBackground ? 'Background agent' : 'Sub-agent')

  const totalTools = messages.reduce((sum, m) => sum + (m.toolUseCount ?? m.toolCalls.length), 0)
  const totalDuration = messages.reduce((sum, m) => sum + (m.durationMs ?? 0), 0)
  const allDone = messages.every((m) => !m.status || m.status === 'completed')

  return (
    <div className="rounded-md border border-indigo-400/15 bg-indigo-500/[0.03] text-[12px] dark:border-indigo-400/10 dark:bg-indigo-500/[0.05]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded((prev) => !prev)
        }}
        className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-indigo-500/[0.05] dark:hover:bg-indigo-500/[0.08]"
      >
        <ChevronRight
          className={cn(
            'size-3 shrink-0 text-muted-foreground transition-transform duration-100',
            expanded && 'rotate-90',
          )}
        />
        <Layers className="size-3 shrink-0 text-indigo-500/70 dark:text-indigo-400/70" />
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground/40">
          {totalTools > 0 && <span>{totalTools} tools</span>}
          {totalDuration > 0 && <span>{(totalDuration / 1000).toFixed(1)}s</span>}
          {allDone ? (
            <CheckCircle2 className="size-3 text-muted-foreground/30" />
          ) : (
            <Loader2 className="size-3 animate-spin text-blue-400" />
          )}
        </span>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-indigo-400/10 px-2.5 py-2">
          {messages.map((agentMsg, i) => {
            if (
              agentMsg.text.length === 0 &&
              agentMsg.toolCalls.length === 0 &&
              agentMsg.thinking.length === 0
            ) {
              return null
            }

            return (
              <div key={i} className="space-y-1.5">
                {agentMsg.thinking.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded bg-muted/10 px-2 py-1 text-[11px] italic text-muted-foreground/60">
                    {agentMsg.thinking.join('\n\n')}
                  </div>
                )}

                {agentMsg.toolCalls.length > 0 && (
                  <div className="space-y-1">
                    {agentMsg.toolCalls.map((tc, j) => (
                      <ToolCallItemView key={j} toolCall={tc} />
                    ))}
                  </div>
                )}

                {agentMsg.text.length > 0 && (
                  <>
                    {agentMsg.toolCalls.length > 0 && (
                      <div className="border-t border-indigo-400/10 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
                        Result
                      </div>
                    )}
                    <div className="text-[12px] leading-relaxed text-foreground/80">
                      <Markdown content={agentMsg.text.join('\n\n')} />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
