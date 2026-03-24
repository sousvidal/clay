import { useState } from 'react'
import { vscodeApi } from '../../lib/vscode'
import {
  ChevronRight,
  FileText,
  FileEdit,
  Search,
  FilePlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
  Globe,
  Brain,
  Layers,
  Minimize2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type {
  ContentBlock,
  TextBlock,
  ThinkingBlock,
  ToolCallBlock,
  SubAgentBlock,
  CompactionBlock,
  ToolCall,
} from '../../lib/types'
import { Markdown } from './Markdown'

// ── Tool helpers ────────────────────────────────────────────────────

function getToolIcon(name: string): React.ReactNode {
  switch (name) {
    case 'Read':
      return <FileText className="size-3" />
    case 'Edit':
      return <FileEdit className="size-3" />
    case 'Write':
      return <FilePlus className="size-3" />
    case 'Grep':
    case 'Glob':
      return <Search className="size-3" />
    case 'Bash':
      return <Terminal className="size-3" />
    case 'WebFetch':
    case 'WebSearch':
      return <Globe className="size-3" />
    case 'Agent':
    case 'Task':
      return <Layers className="size-3" />
    default:
      return <FileText className="size-3" />
  }
}

function getOpenablePath(toolCall: ToolCall): string | null {
  const inp = toolCall.input
  switch (toolCall.name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return (inp.file_path as string) ?? null
    default:
      return null
  }
}

function getToolSummary(toolCall: ToolCall): string {
  const inp = toolCall.input
  switch (toolCall.name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(inp.file_path ?? '')
    case 'Grep':
      return `${inp.pattern ?? ''} ${inp.path ? `in ${inp.path}` : ''}`
    case 'Glob':
      return String(inp.pattern ?? '')
    case 'Bash':
      return String(inp.command ?? '')
    case 'WebFetch':
      return String(inp.url ?? '')
    case 'WebSearch':
      return String(inp.query ?? '')
    default:
      return ''
  }
}

// ── Individual tool call renderer (reused in SubAgentView) ──────────

export function ToolCallItemView({ toolCall }: { toolCall: ToolCall }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isRunning = toolCall.status === 'running'
  const summary = getToolSummary(toolCall)
  const openablePath = getOpenablePath(toolCall)
  const lineNumber =
    toolCall.name === 'Read' ? (toolCall.input.offset as number | undefined) : undefined

  function handleOpenFile(e: React.MouseEvent): void {
    e.stopPropagation()
    if (!openablePath) return
    vscodeApi.postMessage({ command: 'openFile', filePath: openablePath, line: lineNumber })
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
          (openablePath ? (
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

// ── Block components ────────────────────────────────────────────────

export function TextBlockView({ block }: { block: TextBlock }): React.JSX.Element {
  return (
    <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-card px-4 py-3 text-[13px] leading-relaxed text-foreground">
      <Markdown content={block.text} />
    </div>
  )
}

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

export function ToolCallView({ block }: { block: ToolCallBlock }): React.JSX.Element {
  return <ToolCallItemView toolCall={block.toolCall} />
}

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
    default:
      return null
  }
}
