import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { PermissionRequest } from '../../lib/types'

interface PermissionRequestViewProps {
  request: PermissionRequest
  onRespond: (requestId: string, allow: boolean, remember: boolean, toolName: string) => void
}

function getInputSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(input.file_path ?? '')
    case 'Grep':
      return `${input.pattern ?? ''} ${input.path ? `in ${String(input.path)}` : ''}`.trim()
    case 'Glob':
      return String(input.pattern ?? '')
    case 'Bash':
      return String(input.command ?? '')
    case 'WebFetch':
      return String(input.url ?? '')
    case 'WebSearch':
      return String(input.query ?? '')
    default:
      return JSON.stringify(input).slice(0, 100)
  }
}

export function PermissionRequestView({
  request,
  onRespond,
}: PermissionRequestViewProps): React.JSX.Element {
  const [remember, setRemember] = useState(false)
  const summary = getInputSummary(request.toolName, request.toolInput)

  function respond(allow: boolean): void {
    onRespond(request.requestId, allow, remember, request.toolName)
  }

  return (
    <div className="mx-auto w-full max-w-5xl shrink-0 px-4 pb-2">
      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-[12px]">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500/70" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-medium text-foreground/80">{request.toolName}</span>
            {summary && (
              <span className="min-w-0 truncate text-muted-foreground/60">{summary}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => respond(true)}
              className="rounded bg-foreground/10 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/20"
            >
              Allow
            </button>
            <button
              onClick={() => respond(false)}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                'text-muted-foreground hover:bg-foreground/10',
              )}
            >
              Deny
            </button>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-muted-foreground/60 hover:text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-3 accent-foreground"
              />
              <span>Remember</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
