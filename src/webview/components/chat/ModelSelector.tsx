import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { MODELS, EFFORTS } from './conversation-utils'

interface ModelSelectorProps {
  model: string
  effort: string | null
  onModelChange: (model: string) => void
  onEffortChange: (effort: string | null) => void
}

export function ModelSelector({
  model,
  effort,
  onModelChange,
  onEffortChange,
}: ModelSelectorProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/40 transition-colors hover:bg-foreground/5 hover:text-muted-foreground/70"
      >
        <span>{MODELS.find((m) => m.id === model)?.label ?? model}</span>
        {effort && <span className="text-muted-foreground/25">·</span>}
        {effort && <span>{effort}</span>}
        <ChevronDown className="size-2.5" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-1 min-w-[160px] rounded-md border border-border/50 bg-popover p-1.5 shadow-md">
          <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
            Model
          </div>
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onModelChange(m.id)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-accent',
                model === m.id ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {model === m.id ? (
                <Check className="size-2.5 shrink-0" />
              ) : (
                <span className="size-2.5 shrink-0" />
              )}
              {m.label}
            </button>
          ))}

          <div className="my-1 border-t border-border/30" />
          <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
            Thinking effort
          </div>
          {(
            [{ id: null, label: 'Default' }, ...EFFORTS] as Array<{
              id: string | null
              label: string
            }>
          ).map((e) => (
            <button
              key={e.id ?? 'default'}
              onClick={() => {
                onEffortChange(e.id)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-accent',
                effort === e.id ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {effort === e.id ? (
                <Check className="size-2.5 shrink-0" />
              ) : (
                <span className="size-2.5 shrink-0" />
              )}
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
