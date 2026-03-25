import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  ChevronDown,
  Check,
  Folder,
  Square,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Attachment, SlashCommand, WorkspaceFile, UserAttachment } from '../../lib/types'
import { vscodeApi } from '../../lib/vscode'
import { MODELS, EFFORTS, isImageType, readFileAsAttachment } from './conversation-utils'

interface ChatInputProps {
  isActive: boolean
  slashCommands: SlashCommand[]
  workspaceFiles: WorkspaceFile[]
  planMode: boolean
  turnsLength: number
  pendingHookQuestion: boolean
  onSendMessage: (
    text: string,
    attachments: Attachment[],
    model: string,
    effort: string | null,
    planMode: boolean,
  ) => void
  onStopSession: () => void
  onTogglePlanMode: (enabled: boolean) => void
  onDismissHookQuestion: () => void
  onSentAttachments: (idx: number, attachments: UserAttachment[]) => void
  onPendingUserMessage: (msg: { text: string; attachments: Attachment[] } | null) => void
}

export function ChatInput({
  isActive,
  slashCommands,
  workspaceFiles,
  planMode,
  turnsLength,
  pendingHookQuestion,
  onSendMessage,
  onStopSession,
  onTogglePlanMode,
  onDismissHookQuestion,
  onSentAttachments,
  onPendingUserMessage,
}: ChatInputProps): React.JSX.Element {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectorRef = useRef<HTMLDivElement>(null)

  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [model, setModel] = useState<string>('sonnet')
  const [effort, setEffort] = useState<string | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [fileHighlightedIndex, setFileHighlightedIndex] = useState(0)

  // ── Slash command autocomplete ────────────────────────────────────
  const showAutocomplete = inputValue.startsWith('/') && !inputValue.includes(' ') && !sending
  const slashQuery = inputValue.slice(1).toLowerCase()
  const filteredCommands = showAutocomplete
    ? slashCommands.filter((cmd) => cmd.name.slice(1).startsWith(slashQuery))
    : []

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting derived state on query change
    setHighlightedIndex(0)
  }, [slashQuery])

  function selectCommand(name: string): void {
    setInputValue(name + ' ')
    setHighlightedIndex(0)
    inputRef.current?.focus()
  }

  // ── File mention autocomplete (@) ─────────────────────────────────
  const atMatch = !sending ? /@(\S*)$/.exec(inputValue) : null
  const fileQuery = atMatch ? atMatch[1].toLowerCase() : ''
  const filteredFiles = atMatch
    ? workspaceFiles
        .filter(
          (f) =>
            f.relativePath.toLowerCase().includes(fileQuery) ||
            f.name.toLowerCase().includes(fileQuery),
        )
        .slice(0, 50)
    : []

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting derived state on query change
    setFileHighlightedIndex(0)
  }, [fileQuery])

  useEffect(() => {
    function onWorkspaceFileContent(
      event: MessageEvent<{
        command: string
        name?: string
        mediaType?: string
        data?: string
        isText?: boolean
      }>,
    ): void {
      const msg = event.data
      if (
        msg.command !== 'workspaceFileContent' ||
        !msg.name ||
        !msg.mediaType ||
        msg.data === undefined
      )
        return
      const att: Attachment = {
        id: crypto.randomUUID(),
        name: msg.name,
        mediaType: msg.mediaType,
        data: msg.data,
        isText: msg.isText ?? false,
        previewUrl: msg.mediaType.startsWith('image/')
          ? `data:${msg.mediaType};base64,${msg.data}`
          : undefined,
      }
      setAttachments((prev) => [...prev, att])
    }
    window.addEventListener('message', onWorkspaceFileContent)
    return () => window.removeEventListener('message', onWorkspaceFileContent)
  }, [])

  function selectFile(file: WorkspaceFile): void {
    if (file.isDirectory) {
      setInputValue((prev) => prev.replace(/@\S*$/, `@${file.relativePath}/`))
      setFileHighlightedIndex(0)
      inputRef.current?.focus()
    } else {
      setInputValue((prev) => prev.replace(/@\S*$/, ''))
      setFileHighlightedIndex(0)
      inputRef.current?.focus()
      vscodeApi.postMessage({ command: 'getWorkspaceFile', filePath: file.path })
    }
  }

  useEffect(() => {
    if (!selectorOpen) return
    function onPointerDown(e: PointerEvent): void {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [selectorOpen])

  function removeAttachment(id: string): void {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id)
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl)
      return prev.filter((a) => a.id !== id)
    })
  }

  async function addFiles(files: FileList | File[] | null): Promise<void> {
    if (!files || files.length === 0) return
    const newAtts = await Promise.all(Array.from(files).map(readFileAsAttachment))
    setAttachments((prev) => [...prev, ...newAtts])
  }

  function handleSend(): void {
    const text = inputValue.trim()
    if ((!text && attachments.length === 0) || sending) return

    // Handle /plan as a local toggle
    if (text.toLowerCase() === '/plan' && attachments.length === 0) {
      setInputValue('')
      onTogglePlanMode(!planMode)
      return
    }

    // Dismiss any pending hook question when the user sends a regular message
    if (pendingHookQuestion) {
      onDismissHookQuestion()
    }

    setSending(true)
    setInputValue('')
    const toSend = [...attachments]
    setAttachments([])
    onPendingUserMessage({ text, attachments: toSend })
    if (toSend.length > 0) {
      const idx = turnsLength
      const saved: UserAttachment[] = toSend.map((att) => ({
        name: att.name,
        mediaType: att.mediaType,
        data: '',
        isImage: isImageType(att.mediaType),
      }))
      onSentAttachments(idx, saved)
    }
    toSend.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    })
    onSendMessage(text, toSend, model, effort, planMode)
    setTimeout(() => setSending(false), 500)
  }

  const canSend = !sending && (inputValue.trim().length > 0 || attachments.length > 0)

  const fileAccept =
    'image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.yaml,.yml,.csv,.xml,.html,.htm,.css,.py,.rs,.go,.java,.rb,.sh,.bash,.zsh,.toml,.ini,.graphql,.sql,.vue,.svelte,.c,.cpp,.h,.hpp,.cs,.kt,.swift'

  return (
    <>
      <div className="relative mx-auto w-full max-w-5xl shrink-0 px-4 pb-3 pt-2">
        {/* Slash command autocomplete popup */}
        {filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-1 max-h-64 overflow-y-auto rounded-md border border-border/50 bg-popover shadow-md">
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.name}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectCommand(cmd.name)
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors',
                  i === highlightedIndex ? 'bg-accent' : 'hover:bg-accent/50',
                )}
              >
                <span className="w-36 shrink-0 font-mono text-foreground">{cmd.name}</span>
                <span className="truncate text-muted-foreground">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
        {filteredFiles.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-1 max-h-64 overflow-y-auto rounded-md border border-border/50 bg-popover shadow-md">
            {filteredFiles.map((file, i) => (
              <button
                key={file.path}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectFile(file)
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors',
                  i === fileHighlightedIndex ? 'bg-accent' : 'hover:bg-accent/50',
                )}
              >
                {file.isDirectory ? (
                  <Folder className="size-3 shrink-0 text-muted-foreground/60" />
                ) : (
                  <FileText className="size-3 shrink-0 text-muted-foreground/60" />
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                  {file.relativePath}
                </span>
                {file.isDirectory && <span className="text-muted-foreground/40">›</span>}
              </button>
            ))}
          </div>
        )}
        <div
          className={cn(
            'rounded-md border border-input bg-background transition-colors',
            dragOver && 'border-ring ring-1 ring-ring',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={async (e) => {
            e.preventDefault()
            setDragOver(false)
            await addFiles(e.dataTransfer.files)
          }}
        >
          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-[11px]"
                >
                  {att.previewUrl ? (
                    <img src={att.previewUrl} className="size-4 rounded object-cover" alt="" />
                  ) : (
                    <FileText className="size-3 shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="max-w-[120px] truncate text-muted-foreground">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="ml-0.5 text-muted-foreground/40 hover:text-muted-foreground"
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-muted-foreground"
              title="Attach file"
            >
              <Paperclip className="size-3.5" />
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-muted-foreground"
              title="Attach image"
            >
              <ImageIcon className="size-3.5" />
            </button>

            {/* Model / effort selector */}
            <div ref={selectorRef} className="relative shrink-0">
              <button
                onClick={() => setSelectorOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/40 transition-colors hover:bg-foreground/5 hover:text-muted-foreground/70"
              >
                <span>{MODELS.find((m) => m.id === model)?.label ?? model}</span>
                {effort && <span className="text-muted-foreground/25">·</span>}
                {effort && <span>{effort}</span>}
                {planMode && <span className="text-muted-foreground/25">·</span>}
                {planMode && <span>Plan</span>}
                <ChevronDown className="size-2.5" />
              </button>

              {selectorOpen && (
                <div className="absolute bottom-full left-0 z-10 mb-1 min-w-[160px] rounded-md border border-border/50 bg-popover p-1.5 shadow-md">
                  <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
                    Model
                  </div>
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id)
                        setSelectorOpen(false)
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
                        setEffort(e.id)
                        setSelectorOpen(false)
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

                  <div className="my-1 border-t border-border/30" />
                  <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
                    Mode
                  </div>
                  {(
                    [
                      { id: false, label: 'Agent' },
                      { id: true, label: 'Plan' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={String(m.id)}
                      onClick={() => {
                        onTogglePlanMode(m.id)
                        setSelectorOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-accent',
                        planMode === m.id ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {planMode === m.id ? (
                        <Check className="size-2.5 shrink-0" />
                      ) : (
                        <span className="size-2.5 shrink-0" />
                      )}
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (filteredFiles.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setFileHighlightedIndex((i) => Math.min(i + 1, filteredFiles.length - 1))
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setFileHighlightedIndex((i) => Math.max(i - 1, 0))
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    selectFile(filteredFiles[fileHighlightedIndex])
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setInputValue((prev) => prev.replace(/@\S*$/, ''))
                    return
                  }
                }
                if (filteredCommands.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlightedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHighlightedIndex((i) => Math.max(i - 1, 0))
                    return
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    const selected = filteredCommands[highlightedIndex]
                    if (e.key === 'Enter' && selected.name.slice(1) === slashQuery) {
                      handleSend()
                    } else {
                      selectCommand(selected.name)
                    }
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setInputValue('')
                    return
                  }
                }
                if (e.key === 'Escape' && isActive) {
                  e.preventDefault()
                  onStopSession()
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={sending}
              placeholder="Message Claude..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            />
            {isActive ? (
              <button
                onClick={onStopSession}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                title="Stop generation (Esc)"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
                  canSend
                    ? 'text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground'
                    : 'text-muted-foreground/30',
                )}
              >
                {sending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="size-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={fileAccept}
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )
}
