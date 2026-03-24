import { useCallback, useEffect, useRef, useState } from 'react'
import { Hammer, Save, Trash2, X, Pencil, GripHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Markdown } from './Markdown'

interface PlanSheetProps {
  content: string
  readOnly?: boolean
  onBuild: () => void
  onSave: () => void
  onDiscard: () => void
  onClose?: () => void
  onEdit?: () => void
}

const MIN_HEIGHT = 120
const MAX_HEIGHT_PCT = 60
const DEFAULT_HEIGHT = 200

export function PlanSheet({
  content,
  readOnly = false,
  onBuild,
  onSave,
  onDiscard,
  onClose,
  onEdit,
}: PlanSheetProps): React.JSX.Element {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [visible, setVisible] = useState(false)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setDragging(true)
      dragStartY.current = e.clientY
      dragStartH.current = height
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [height],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return
      const parent = containerRef.current.parentElement
      if (!parent) return
      const maxHeight = parent.clientHeight * (MAX_HEIGHT_PCT / 100)
      const deltaY = e.clientY - dragStartY.current
      const next = Math.min(maxHeight, Math.max(MIN_HEIGHT, dragStartH.current + deltaY))
      setHeight(next)
    },
    [dragging],
  )

  const onPointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        'mx-4 mt-2 flex shrink-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-lg transition-[max-height] duration-300 ease-out',
        visible ? 'max-h-[60vh]' : 'max-h-0',
      )}
      style={{ height: `${height}px` }}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
          Plan
        </span>
        <div className="flex items-center gap-1">
          {readOnly ? (
            <>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <X className="size-3" />
                  Close
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={onBuild}
                className="flex items-center gap-1.5 rounded-md bg-foreground/10 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/20"
              >
                <Hammer className="size-3" />
                Build
              </button>
              <button
                onClick={onSave}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <Save className="size-3" />
                Save
              </button>
              <button
                onClick={onDiscard}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-destructive"
              >
                <Trash2 className="size-3" />
                Discard
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable markdown content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed">
        <Markdown content={content} />
      </div>

      {/* Draggable bottom handle */}
      <div
        className={cn(
          'flex h-3 shrink-0 cursor-row-resize items-center justify-center border-t border-border/20 transition-colors',
          dragging ? 'bg-foreground/10' : 'hover:bg-foreground/5',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <GripHorizontal className="size-3 text-muted-foreground/30" />
      </div>
    </div>
  )
}
