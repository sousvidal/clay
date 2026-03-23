import * as ResizablePrimitive from 'react-resizable-panels'

import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  ...props
}: Omit<ResizablePrimitive.GroupProps, 'direction'>): React.JSX.Element {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps): React.JSX.Element {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  className,
  ...props
}: ResizablePrimitive.SeparatorProps): React.JSX.Element {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        'group/handle relative flex w-px items-center justify-center bg-panel-border transition-colors',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2',
        'hover:w-[3px] hover:bg-blue-400/60',
        'data-resize-handle-active:w-[3px] data-resize-handle-active:bg-blue-400',
        className,
      )}
      {...props}
    />
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
