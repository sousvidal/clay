import { Loader2, GitBranch, FolderOpen } from 'lucide-react'
import type { SessionMeta, TokenUsage } from '../../lib/types'
import { fmtTokens, basename } from './conversation-utils'

interface SessionHeaderProps {
  meta: SessionMeta
  isActive: boolean
  isProcessing: boolean
  totalTokens: TokenUsage | null
}

export function SessionHeader({
  meta,
  isActive,
  isProcessing,
  totalTokens,
}: SessionHeaderProps): React.JSX.Element {
  const cacheTotal = (totalTokens?.cacheReadTokens ?? 0) + (totalTokens?.cacheCreationTokens ?? 0)

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border/30 px-4 py-2 text-[11px] text-muted-foreground/50">
      {isProcessing ? (
        <span className="flex items-center gap-1.5 text-muted-foreground/70">
          <Loader2 className="size-3 animate-spin" />
          Thinking…
        </span>
      ) : isActive ? (
        <span className="flex items-center gap-1.5 text-green-500/70">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
          </span>
          Live
        </span>
      ) : null}
      {meta.gitBranch && (
        <span className="flex items-center gap-1">
          <GitBranch className="size-3" />
          {meta.gitBranch}
        </span>
      )}
      {meta.cwd && (
        <span className="flex items-center gap-1">
          <FolderOpen className="size-3" />
          {basename(meta.cwd)}
        </span>
      )}

      {totalTokens && (
        <span className="ml-auto flex items-center gap-2">
          <span>↑ {fmtTokens(totalTokens.inputTokens + cacheTotal)}</span>
          <span>↓ {fmtTokens(totalTokens.outputTokens)}</span>
        </span>
      )}
      {meta.model && <span className={totalTokens ? '' : 'ml-auto'}>{meta.model}</span>}
    </div>
  )
}
