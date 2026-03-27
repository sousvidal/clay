import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { User, FileText, MessageCircleQuestion } from 'lucide-react'
import type {
  Turn,
  SessionMeta,
  TokenUsage,
  Attachment,
  UserAttachment,
  SlashCommand,
  WorkspaceFile,
  PermissionRequest,
  PendingHookQuestion,
} from '../../lib/types'
import { UserQuestionView } from './block-renderers'
import { Markdown } from './Markdown'
import { PermissionRequestView } from './PermissionRequestView'
import { SessionHeader } from './SessionHeader'
import { TurnView } from './TurnView'
import { ChatInput } from './ChatInput'

// ── Conversation ─────────────────────────────────────────────────────

interface ConversationProps {
  turns: Turn[]
  meta: SessionMeta | null
  isActive: boolean
  isProcessing: boolean
  slashCommands: SlashCommand[]
  workspaceFiles: WorkspaceFile[]
  onSendMessage: (
    text: string,
    attachments: Attachment[],
    model: string,
    effort: string | null,
  ) => void
  onStopSession: () => void
  pendingPermission: PermissionRequest | null
  onPermissionResponse: (
    requestId: string,
    allow: boolean,
    remember: boolean,
    toolName: string,
  ) => void
  pendingHookQuestion: PendingHookQuestion | null
  onHookQuestionAnswer: (answers: Record<string, string>) => void
  onDismissHookQuestion: () => void
}

export function Conversation({
  turns,
  meta,
  isActive,
  isProcessing,
  slashCommands,
  workspaceFiles,
  onSendMessage,
  onStopSession,
  pendingPermission,
  onPermissionResponse,
  pendingHookQuestion,
  onHookQuestionAnswer,
  onDismissHookQuestion,
}: ConversationProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

  // Track answers the user gave to AskUserQuestion dialogs, keyed by tool call id.
  // These are kept in local state because the answers go via stdin and don't
  // appear as a visible user message in the JSONL.
  const [answeredQuestions, setAnsweredQuestions] = useState<Map<string, Record<string, string>>>(
    new Map(),
  )

  const [pendingUserMessage, setPendingUserMessage] = useState<{
    text: string
    attachments: Attachment[]
  } | null>(null)

  // Claude Code does not persist image data in the JSONL, so we stash
  // attachment metadata (name + type only) at send time, keyed by the turn
  // index the new message will occupy.
  const [sentAttachments, setSentAttachments] = useState<Map<number, UserAttachment[]>>(new Map())

  useEffect(() => {
    if (!isAtBottom.current || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [turns, pendingUserMessage])

  // Clear pending message when real turns arrive from JSONL
  useEffect(() => {
    if (pendingUserMessage !== null) setPendingUserMessage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  const virtualizer = useVirtualizer({
    count: turns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 150,
    overscan: 5,
  })

  const totalTokens = turns.reduce<TokenUsage | null>((acc, t) => {
    if (!t.tokenUsage) return acc
    if (!acc) return { ...t.tokenUsage }
    return {
      inputTokens: acc.inputTokens + t.tokenUsage.inputTokens,
      outputTokens: acc.outputTokens + t.tokenUsage.outputTokens,
      cacheReadTokens: (acc.cacheReadTokens ?? 0) + (t.tokenUsage.cacheReadTokens ?? 0),
      cacheCreationTokens: (acc.cacheCreationTokens ?? 0) + (t.tokenUsage.cacheCreationTokens ?? 0),
    }
  }, null)

  return (
    <div className="flex h-full flex-col">
      {meta && (
        <SessionHeader
          meta={meta}
          isActive={isActive}
          isProcessing={isProcessing}
          totalTokens={totalTokens}
        />
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        <div
          className="relative mx-auto max-w-5xl"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const turn = turns[virtualItem.index]
            const extra = sentAttachments.get(virtualItem.index)
            const merged =
              extra && turn.userAttachments.length === 0
                ? { ...turn, userAttachments: extra }
                : turn
            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                <TurnView turn={merged} answeredQuestions={answeredQuestions} />
              </div>
            )
          })}
        </div>

        {/* Pending user message (optimistic display while JSONL is being written) */}
        {pendingUserMessage && (
          <div className="mx-auto max-w-5xl py-4">
            <div className="flex justify-end gap-3 px-6">
              <div className="max-w-[85%] space-y-1.5">
                {pendingUserMessage.attachments
                  .filter((a) => a.mediaType.startsWith('image/'))
                  .map((att, i) => (
                    <div key={i} className="flex justify-end">
                      <img
                        src={`data:${att.mediaType};base64,${att.data}`}
                        className="max-h-48 max-w-xs rounded-xl border border-border/30 object-cover"
                        alt=""
                      />
                    </div>
                  ))}
                {pendingUserMessage.attachments
                  .filter((a) => !a.mediaType.startsWith('image/'))
                  .map((att, i) => (
                    <div key={i} className="flex justify-end">
                      <div className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-[11px]">
                        <FileText className="size-3 shrink-0 text-muted-foreground/60" />
                        <span className="max-w-[160px] truncate text-muted-foreground">
                          {att.name}
                        </span>
                      </div>
                    </div>
                  ))}
                {pendingUserMessage.text && (
                  <div className="rounded-2xl rounded-tr-sm border border-border/40 bg-muted/50 px-4 py-2.5 text-[13px] leading-relaxed text-foreground">
                    <Markdown content={pendingUserMessage.text} />
                  </div>
                )}
              </div>
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="size-3.5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Permission request banner */}
      {pendingPermission && (
        <PermissionRequestView request={pendingPermission} onRespond={onPermissionResponse} />
      )}

      {/* AskUserQuestion hook banner */}
      {pendingHookQuestion && (
        <div className="mx-auto w-full max-w-5xl shrink-0 px-4 pb-2">
          <div className="flex items-start gap-3 rounded-md border border-blue-500/30 bg-blue-500/[0.06] px-3 py-2.5">
            <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0 text-blue-500/70" />
            <div className="min-w-0 flex-1">
              <UserQuestionView
                questions={pendingHookQuestion.questions}
                onSubmit={(answers) => {
                  setAnsweredQuestions((prev) =>
                    new Map(prev).set(pendingHookQuestion.requestId, answers),
                  )
                  onHookQuestionAnswer(answers)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <ChatInput
        isActive={isActive}
        slashCommands={slashCommands}
        workspaceFiles={workspaceFiles}
        turnsLength={turns.length}
        onSendMessage={onSendMessage}
        onStopSession={onStopSession}
        pendingHookQuestion={pendingHookQuestion !== null}
        onDismissHookQuestion={onDismissHookQuestion}
        onSentAttachments={(idx, atts) =>
          setSentAttachments((prev) => new Map(prev).set(idx, atts))
        }
        onPendingUserMessage={setPendingUserMessage}
      />
    </div>
  )
}
