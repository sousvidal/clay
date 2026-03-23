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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  mockConversation,
  type ConversationMessage,
  type ToolCall,
  type CodeBlock,
} from '@/lib/mock-conversation'

function getToolIcon(name: string): React.ReactNode {
  switch (name) {
    case 'Read':
      return <FileText className="size-3" />
    case 'Edit':
      return <FileEdit className="size-3" />
    case 'Write':
      return <FilePlus className="size-3" />
    case 'Grep':
      return <Search className="size-3" />
    default:
      return <FileText className="size-3" />
  }
}

function ToolCallBlock({ toolCall }: { toolCall: ToolCall }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isRunning = toolCall.status === 'running'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((prev) => !prev)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((prev) => !prev)
        }
      }}
      className="mt-1 cursor-pointer rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[12px] transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-2">
        <ChevronRight
          className={cn(
            'size-3 shrink-0 text-muted-foreground transition-transform duration-100',
            expanded && 'rotate-90',
          )}
        />
        <span className="flex size-4 items-center justify-center text-muted-foreground">
          {getToolIcon(toolCall.name)}
        </span>
        <span className="font-mono font-medium text-blue-400">{toolCall.name}</span>
        <span className="truncate font-mono text-muted-foreground">{toolCall.args}</span>
        <span className="ml-auto shrink-0">
          {isRunning ? (
            <Loader2 className="size-3 animate-spin text-blue-400" />
          ) : (
            <CheckCircle2 className="size-3 text-green-400/70" />
          )}
        </span>
      </div>
      {expanded && toolCall.result && (
        <div className="mt-1.5 border-t border-border/30 pt-1.5 pl-[22px] font-mono text-[11px] text-muted-foreground/70">
          {toolCall.result}
        </div>
      )}
    </div>
  )
}

function CodeBlockView({ codeBlock }: { codeBlock: CodeBlock }): React.JSX.Element {
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border/40">
      {codeBlock.filename && (
        <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-1.5">
          <FileText className="size-3 text-muted-foreground" />
          <span className="font-mono text-[11px] text-muted-foreground">{codeBlock.filename}</span>
        </div>
      )}
      <pre className="overflow-x-auto bg-muted/10 p-3">
        <code className="font-mono text-[12px] leading-relaxed text-foreground/90">
          {codeBlock.code}
        </code>
      </pre>
    </div>
  )
}

function StreamingIndicator(): React.JSX.Element {
  return (
    <span className="ml-0.5 inline-block h-4 w-[2px] animate-blink bg-foreground align-middle" />
  )
}

function MessageBubble({ message }: { message: ConversationMessage }): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3 px-6 py-2.5', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-500/10 text-blue-400' : 'bg-violet-500/10 text-violet-400',
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      <div className={cn('min-w-0 max-w-[85%] space-y-1', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed',
            isUser ? 'bg-blue-500/10 text-foreground' : 'text-foreground',
          )}
        >
          <p className="whitespace-pre-wrap">
            {message.content}
            {message.isStreaming && <StreamingIndicator />}
          </p>
        </div>

        {message.codeBlock && (
          <div className="text-left">
            <CodeBlockView codeBlock={message.codeBlock} />
          </div>
        )}

        {message.toolCalls && (
          <div className={cn('space-y-0.5', isUser ? 'text-left' : '')}>
            {message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
          className="relative mx-auto max-w-3xl"
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

      <div className="shrink-0 border-t border-panel-border px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2.5 shadow-sm focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <span className="flex-1 pb-0.5 text-[13px] text-muted-foreground">
              Type a message...
            </span>
            <button className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90">
              <ArrowUp className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
            Claude can make mistakes. Review output carefully.
          </p>
        </div>
      </div>
    </div>
  )
}
