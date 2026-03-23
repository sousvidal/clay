import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ChevronRight,
  Bot,
  User,
  ArrowUp,
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
  Paperclip,
  Image as ImageIcon,
  Minimize2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  mockConversation,
  type ConversationMessage,
  type ContentBlock,
  type ToolCall,
  type CodeBlock,
  type ThinkingBlock,
  type SubAgentBlock,
  type CompactionMarker,
} from '../../lib/mock-conversation'

// ── Tool icons ──────────────────────────────────────────────────────

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
      return <Layers className="size-3" />
    default:
      return <FileText className="size-3" />
  }
}

function getToolSummary(tc: ToolCall): string {
  const inp = tc.input
  switch (tc.name) {
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

// ── Block renderers ─────────────────────────────────────────────────

function ThinkingBlockView({ block }: { block: ThinkingBlock }): React.JSX.Element {
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
        <p className="mt-1.5 whitespace-pre-wrap border-t border-border/20 pt-1.5 text-[12px] italic leading-relaxed text-muted-foreground/70">
          {block.text}
        </p>
      )}
    </div>
  )
}

function ToolCallView({ block }: { block: ToolCall }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isRunning = block.status === 'running'
  const summary = getToolSummary(block)

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
        <span className="text-muted-foreground">{getToolIcon(block.name)}</span>
        <span className="font-mono font-medium text-foreground/80">{block.name}</span>
        {summary && (
          <span className="min-w-0 truncate font-mono text-muted-foreground/60">{summary}</span>
        )}
        <span className="ml-auto shrink-0">
          {isRunning ? (
            <Loader2 className="size-3 animate-spin text-blue-400" />
          ) : block.isError ? (
            <XCircle className="size-3 text-red-400" />
          ) : (
            <CheckCircle2 className="size-3 text-muted-foreground/30" />
          )}
        </span>
      </div>
      {expanded && block.result && (
        <pre
          className={cn(
            'mt-1.5 overflow-x-auto border-t border-border/20 pt-1.5 pl-5 font-mono text-[11px] leading-relaxed',
            block.isError ? 'text-red-400/80' : 'text-muted-foreground/60',
          )}
        >
          {block.result}
        </pre>
      )}
    </div>
  )
}

function CodeBlockView({ block }: { block: CodeBlock }): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-border/30">
      {block.filename && (
        <div className="flex items-center gap-2 border-b border-border/30 bg-muted/20 px-3 py-1">
          <FileText className="size-3 text-muted-foreground/60" />
          <span className="font-mono text-[11px] text-muted-foreground">{block.filename}</span>
        </div>
      )}
      <pre className="overflow-x-auto bg-muted/10 p-3">
        <code className="font-mono text-[12px] leading-relaxed text-foreground/85">
          {block.code}
        </code>
      </pre>
    </div>
  )
}

function SubAgentView({ block }: { block: SubAgentBlock }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isRunning = block.status === 'running'

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
        <Layers className="size-3 shrink-0 text-indigo-500/70 dark:text-indigo-400/70" />
        <span className="font-medium text-foreground/80">{block.agentName}</span>
        <span className="text-muted-foreground/40">({block.subagentType})</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {block.durationMs && (
            <span className="text-[10px] text-muted-foreground/40">
              {(block.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {isRunning ? (
            <Loader2 className="size-3 animate-spin text-blue-400" />
          ) : (
            <CheckCircle2 className="size-3 text-muted-foreground/30" />
          )}
        </span>
      </div>
      {expanded && (
        <div className="space-y-1.5 border-t border-border/20 px-2.5 py-2">
          {block.text && (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
              {block.text}
            </p>
          )}
          {block.toolCalls?.map((tc) => (
            <ToolCallView key={tc.id} block={tc} />
          ))}
        </div>
      )}
    </div>
  )
}

function CompactionView({ block }: { block: CompactionMarker }): React.JSX.Element {
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

function StreamingIndicator(): React.JSX.Element {
  return (
    <span className="ml-0.5 inline-block h-4 w-[2px] animate-blink bg-foreground align-middle" />
  )
}

// ── Content block dispatcher ────────────────────────────────────────

function BlockRenderer({ block }: { block: ContentBlock }): React.JSX.Element | null {
  switch (block.kind) {
    case 'text':
      return null
    case 'thinking':
      return <ThinkingBlockView block={block} />
    case 'tool_call':
      return <ToolCallView block={block} />
    case 'code':
      return <CodeBlockView block={block} />
    case 'image':
      return (
        <div className="overflow-hidden rounded-md border border-border/30">
          <div className="flex h-32 items-center justify-center bg-muted/10 text-muted-foreground/30">
            <ImageIcon className="size-8" />
          </div>
          {block.alt && (
            <p className="border-t border-border/30 px-2.5 py-1 text-[11px] text-muted-foreground">
              {block.alt}
            </p>
          )}
        </div>
      )
    case 'sub_agent':
      return <SubAgentView block={block} />
    case 'compaction':
      return <CompactionView block={block} />
  }
}

// ── Message bubble ──────────────────────────────────────────────────

function MessageBubble({ message }: { message: ConversationMessage }): React.JSX.Element {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="py-1">
        {message.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    )
  }

  const textParts = message.blocks.filter((b) => b.kind === 'text')
  const otherBlocks = message.blocks.filter((b) => b.kind !== 'text')
  const fullText = textParts.map((b) => b.text).join('\n\n')

  return (
    <div className={cn('flex gap-3 px-6 py-2.5', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      <div className={cn('min-w-0 flex-1 space-y-1.5', isUser && 'text-right')}>
        {!isUser && message.model && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
            <span>{message.model}</span>
            {message.durationMs && <span>{(message.durationMs / 1000).toFixed(1)}s</span>}
          </div>
        )}

        {fullText && (
          <div
            className={cn(
              'text-[13px] leading-relaxed',
              isUser
                ? 'inline-block rounded-lg bg-blue-500/10 px-3.5 py-2.5 text-foreground'
                : 'text-foreground/90',
            )}
          >
            <p className="whitespace-pre-wrap">
              {fullText}
              {message.isStreaming && <StreamingIndicator />}
            </p>
          </div>
        )}

        {otherBlocks.length > 0 && (
          <div className={cn('space-y-1.5', isUser ? 'text-left' : '')}>
            {otherBlocks.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Conversation container ──────────────────────────────────────────

export function MockConversation(): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: mockConversation.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 5,
  })

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative mx-auto max-w-5xl"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              <MessageBubble message={mockConversation[virtualItem.index]} />
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl shrink-0 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 focus-within:border-ring">
          <button className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-muted-foreground">
            <Paperclip className="size-3.5" />
          </button>
          <button className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-muted-foreground">
            <ImageIcon className="size-3.5" />
          </button>
          <input
            type="text"
            placeholder="Message Clay..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <button className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground">
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
