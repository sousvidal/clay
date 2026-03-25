import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { vscodeApi } from '../../../lib/vscode'
import { cn } from '../../../lib/utils'
import type { ToolCall } from '../../../lib/types'
import { getToolIcon, getFileContext, getToolSummary } from './tool-helpers'

export function ToolCallItemView({ toolCall }: { toolCall: ToolCall }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isRunning = toolCall.status === 'running'
  const summary = getToolSummary(toolCall)
  const fileContext = getFileContext(toolCall)

  function handleOpenFile(e: React.MouseEvent): void {
    e.stopPropagation()
    if (!fileContext) return
    vscodeApi.postMessage({
      command: 'openFile',
      filePath: fileContext.path,
      line: fileContext.line,
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((prev) => !prev)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setExpanded((prev) => !prev)
      }}
      className="cursor-pointer rounded-md border border-border/30 px-2.5 py-1.5 text-[12px] transition-colors hover:bg-muted/15"
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{getToolIcon(toolCall.name)}</span>
        <span className="font-mono font-medium text-foreground/80">{toolCall.name}</span>
        {summary &&
          (fileContext ? (
            <button
              onClick={handleOpenFile}
              className="min-w-0 truncate font-mono text-muted-foreground/60 hover:text-foreground/80 hover:underline"
            >
              {summary}
            </button>
          ) : (
            <span className="min-w-0 truncate font-mono text-muted-foreground/60">{summary}</span>
          ))}
        <span className="ml-auto shrink-0">
          {isRunning ? (
            <Loader2 className="size-3 animate-spin text-blue-400" />
          ) : toolCall.isError ? (
            <XCircle className="size-3 text-red-400" />
          ) : (
            <CheckCircle2 className="size-3 text-muted-foreground/30" />
          )}
        </span>
      </div>
      {expanded && toolCall.result && (
        <pre
          className={cn(
            'mt-1.5 overflow-x-auto border-t border-border/20 pt-1.5 pl-5 font-mono text-[11px] leading-relaxed',
            toolCall.isError ? 'text-red-400/80' : 'text-muted-foreground/60',
          )}
        >
          {toolCall.result}
        </pre>
      )}
    </div>
  )
}
