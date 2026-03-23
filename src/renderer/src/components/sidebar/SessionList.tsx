import { Plus, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { mockSessions } from '@/lib/mock-sessions'

export function SessionList(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-1.5">
          {mockSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/50',
                session.active && 'bg-accent',
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-[13px] font-medium">{session.title}</span>
              </div>
              <p className="truncate pl-[22px] text-[11px] text-muted-foreground">
                {session.preview}
              </p>
              <span className="pl-[22px] text-[10px] text-muted-foreground/60">
                {session.timestamp}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
