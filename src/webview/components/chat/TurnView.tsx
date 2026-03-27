import { Bot, User, Image as ImageIcon, FileText } from 'lucide-react'
import type { Turn, UserAttachment } from '../../lib/types'
import { BlockRenderer } from './block-renderers'
import { Markdown } from './Markdown'
import { formatRelativeTime } from './conversation-utils'

export function TurnView({
  turn,
  answeredQuestions,
}: {
  turn: Turn
  answeredQuestions?: Map<string, Record<string, string>>
}): React.JSX.Element {
  const renderableImages = turn.userAttachments.filter((a: UserAttachment) => a.isImage && a.data)
  const chips = turn.userAttachments.filter((a: UserAttachment) => !a.isImage || !a.data)
  const hasUserContent = turn.userMessage || turn.userAttachments.length > 0

  const displayBlocks = turn.contentBlocks

  return (
    <div className="space-y-6 py-4">
      {hasUserContent && (
        <div className="flex justify-end gap-3 px-6">
          <div className="max-w-[85%] space-y-1.5">
            {renderableImages.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {renderableImages.map((att: UserAttachment, i: number) => (
                  <img
                    key={i}
                    src={`data:${att.mediaType};base64,${att.data}`}
                    className="max-h-48 max-w-xs rounded-xl border border-border/30 object-cover"
                    alt=""
                  />
                ))}
              </div>
            )}
            {chips.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {chips.map((att: UserAttachment, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-[11px]"
                  >
                    {att.isImage ? (
                      <ImageIcon className="size-3 shrink-0 text-muted-foreground/60" />
                    ) : (
                      <FileText className="size-3 shrink-0 text-muted-foreground/60" />
                    )}
                    <span className="max-w-[160px] truncate text-muted-foreground">
                      {att.name || att.mediaType}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {turn.userMessage && (
              <div className="rounded-2xl rounded-tr-sm border border-border/40 bg-muted/50 px-4 py-2.5 text-[13px] leading-relaxed text-foreground">
                <Markdown content={turn.userMessage} />
              </div>
            )}
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="size-3.5" />
          </div>
        </div>
      )}

      {displayBlocks.length > 0 && (
        <div className="flex gap-3 px-6 pb-4">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground/70">
            <Bot className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
              {turn.model && <span>{turn.model}</span>}
              {turn.durationMs != null && <span>{(turn.durationMs / 1000).toFixed(1)}s</span>}
              {turn.timestamp && <span>{formatRelativeTime(turn.timestamp)}</span>}
            </div>

            <div className="space-y-2">
              {displayBlocks.map((block, i) => (
                <BlockRenderer key={i} block={block} answeredQuestions={answeredQuestions} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
