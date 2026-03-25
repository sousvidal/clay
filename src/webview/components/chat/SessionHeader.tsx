import { useEffect, useRef, useState } from 'react'
import { Loader2, GitBranch, FolderOpen, ClipboardList } from 'lucide-react'
import type { SessionMeta, TokenUsage, SavedPlan } from '../../lib/types'
import { formatRelativeTime, fmtTokens, basename } from './conversation-utils'

interface SessionHeaderProps {
  meta: SessionMeta
  isActive: boolean
  isProcessing: boolean
  totalTokens: TokenUsage | null
  savedPlans: SavedPlan[]
  onLoadSavedPlan: (planId: string) => void
  onNewPlan: () => void
}

export function SessionHeader({
  meta,
  isActive,
  isProcessing,
  totalTokens,
  savedPlans,
  onLoadSavedPlan,
  onNewPlan,
}: SessionHeaderProps): React.JSX.Element {
  const cacheTotal = (totalTokens?.cacheReadTokens ?? 0) + (totalTokens?.cacheCreationTokens ?? 0)
  const [plansOpen, setPlansOpen] = useState(false)
  const plansRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!plansOpen) return
    function onPointerDown(e: PointerEvent): void {
      if (plansRef.current && !plansRef.current.contains(e.target as Node)) {
        setPlansOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [plansOpen])

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

      {/* Plans button */}
      <div ref={plansRef} className="relative">
        <button
          onClick={() => setPlansOpen((prev) => !prev)}
          className="relative flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-foreground/5 hover:text-muted-foreground/70"
          title="Plans"
        >
          <ClipboardList className="size-3" />
          {savedPlans.length > 0 && (
            <span className="flex size-3.5 items-center justify-center rounded-full bg-foreground/10 text-[8px] font-medium">
              {savedPlans.length}
            </span>
          )}
        </button>
        {plansOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 min-w-[200px] rounded-md border border-border/50 bg-popover p-1 shadow-md">
            <button
              onClick={() => {
                setPlansOpen(false)
                onNewPlan()
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent"
            >
              + New plan
            </button>
            {savedPlans.length > 0 && <div className="my-1 border-t border-border/30" />}
            {savedPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => {
                  setPlansOpen(false)
                  onLoadSavedPlan(plan.id)
                }}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-accent"
              >
                <span className="min-w-0 truncate text-foreground">{plan.title}</span>
                <span className="shrink-0 text-[9px] text-muted-foreground/40">
                  {formatRelativeTime(plan.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

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
