import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Bot,
  User,
  GitBranch,
  FolderOpen,
  ArrowUp,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  ChevronDown,
  Check,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type {
  Turn,
  SessionMeta,
  TokenUsage,
  Attachment,
  UserAttachment,
  SlashCommand,
} from '../../lib/types'
import { BlockRenderer } from './BlockRenderers'
import { Markdown } from './Markdown'

// ── Model / effort config ─────────────────────────────────────────────

const MODELS = [
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' },
  { id: 'opus', label: 'Opus' },
] as const

const EFFORTS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'max', label: 'Max' },
] as const

// ── Helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return ''

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

function formatTokenUsage(usage: TokenUsage): string {
  const k = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
  return `${k(usage.inputTokens)} → ${k(usage.outputTokens)}`
}

function basename(p: string): string {
  return p.split('/').pop() ?? p
}

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'yaml',
  'yml',
  'csv',
  'xml',
  'html',
  'htm',
  'css',
  'py',
  'rs',
  'go',
  'java',
  'rb',
  'sh',
  'bash',
  'zsh',
  'toml',
  'ini',
  'env',
  'graphql',
  'sql',
  'vue',
  'svelte',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'kt',
  'swift',
])

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'pdf') return 'application/pdf'
  if (TEXT_EXTENSIONS.has(ext)) return 'text/plain'
  return 'application/octet-stream'
}

function isImageType(mediaType: string): boolean {
  return mediaType.startsWith('image/')
}

function isTextType(mediaType: string, filename: string): boolean {
  if (mediaType.startsWith('text/')) return true
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return TEXT_EXTENSIONS.has(ext)
}

function readFileAsAttachment(file: File): Promise<Attachment> {
  const mediaType = file.type || guessMimeType(file.name)
  const isText = isTextType(mediaType, file.name)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(reader.error)

    if (isText) {
      reader.onload = () => {
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          mediaType,
          data: reader.result as string,
          isText: true,
        })
      }
      reader.readAsText(file)
    } else {
      reader.onload = () => {
        // Strip "data:<mediaType>;base64," prefix
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1] ?? ''
        const previewUrl = isImageType(mediaType) ? URL.createObjectURL(file) : undefined
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          mediaType,
          data: base64,
          isText: false,
          previewUrl,
        })
      }
      reader.readAsDataURL(file)
    }
  })
}

// ── Session header ────────────────────────────────────────────────────

interface SessionHeaderProps {
  meta: SessionMeta
  isActive: boolean
}

function SessionHeader({ meta, isActive }: SessionHeaderProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border/30 px-4 py-2 text-[11px] text-muted-foreground/50">
      {isActive && (
        <span className="flex items-center gap-1.5 text-green-500/70">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
          </span>
          Live
        </span>
      )}
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
      {meta.model && <span className="ml-auto">{meta.model}</span>}
    </div>
  )
}

// ── Turn ─────────────────────────────────────────────────────────────

function TurnView({ turn }: { turn: Turn }): React.JSX.Element {
  const renderableImages = turn.userAttachments.filter((a: UserAttachment) => a.isImage && a.data)
  const chips = turn.userAttachments.filter((a: UserAttachment) => !a.isImage || !a.data)
  const hasUserContent = turn.userMessage || turn.userAttachments.length > 0

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

      {turn.contentBlocks.length > 0 && (
        <div className="flex gap-3 px-6 pb-4">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground/70">
            <Bot className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
              {turn.model && <span>{turn.model}</span>}
              {turn.durationMs != null && <span>{(turn.durationMs / 1000).toFixed(1)}s</span>}
              {turn.tokenUsage && <span>{formatTokenUsage(turn.tokenUsage)}</span>}
              {turn.timestamp && <span>{formatRelativeTime(turn.timestamp)}</span>}
            </div>

            <div className="space-y-2">
              {turn.contentBlocks.map((block, i) => (
                <BlockRenderer key={i} block={block} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Conversation ─────────────────────────────────────────────────────

interface ConversationProps {
  turns: Turn[]
  meta: SessionMeta | null
  isActive: boolean
  slashCommands: SlashCommand[]
  onSendMessage: (
    text: string,
    attachments: Attachment[],
    model: string,
    effort: string | null,
  ) => void
}

export function Conversation({
  turns,
  meta,
  isActive,
  slashCommands,
  onSendMessage,
}: ConversationProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isAtBottom = useRef(true)
  const selectorRef = useRef<HTMLDivElement>(null)

  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [model, setModel] = useState<string>('sonnet')
  const [effort, setEffort] = useState<string | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [pendingUserMessage, setPendingUserMessage] = useState<{
    text: string
    attachments: Attachment[]
  } | null>(null)

  // Claude Code does not persist image data in the JSONL, so we stash
  // attachment metadata (name + type only) at send time, keyed by the turn
  // index the new message will occupy. At send time turns.length IS that index.
  const [sentAttachments, setSentAttachments] = useState<Map<number, UserAttachment[]>>(new Map())
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  // ── Slash command autocomplete ────────────────────────────────────
  const showAutocomplete = inputValue.startsWith('/') && !inputValue.includes(' ') && !sending
  const slashQuery = inputValue.slice(1).toLowerCase()
  const filteredCommands = showAutocomplete
    ? slashCommands.filter((cmd) => cmd.name.slice(1).startsWith(slashQuery))
    : []

  useEffect(() => {
    setHighlightedIndex(0)
  }, [slashQuery])

  function selectCommand(name: string): void {
    setInputValue(name + ' ')
    setHighlightedIndex(0)
    inputRef.current?.focus()
  }

  useEffect(() => {
    if (!isAtBottom.current || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [turns, pendingUserMessage])

  // Clear pending message when real turns arrive from JSONL
  useEffect(() => {
    if (pendingUserMessage !== null) setPendingUserMessage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length])

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
    setSending(true)
    setInputValue('')
    const toSend = [...attachments]
    setAttachments([])
    // Show message + attachments immediately (optimistic UI)
    setPendingUserMessage({ text, attachments: toSend })
    // Stash lightweight metadata so the chip persists after the JSONL turn arrives
    // (Claude Code does not write image data to the JSONL).
    // turns.length is the 0-based index the new turn will occupy.
    if (toSend.length > 0) {
      const idx = turns.length
      const saved: UserAttachment[] = toSend.map((att) => ({
        name: att.name,
        mediaType: att.mediaType,
        data: '',
        isImage: isImageType(att.mediaType),
      }))
      setSentAttachments((prev) => new Map(prev).set(idx, saved))
    }
    // Revoke object URLs after capturing for pending display (data URIs used for rendering)
    toSend.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    })
    onSendMessage(text, toSend, model, effort)
    setTimeout(() => setSending(false), 500)
  }

  const canSend = !sending && (inputValue.trim().length > 0 || attachments.length > 0)

  return (
    <div className="flex h-full flex-col">
      {meta && <SessionHeader meta={meta} isActive={isActive} />}

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
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
                <TurnView turn={merged} />
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

      {/* Input area */}
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
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
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
                    selectCommand(filteredCommands[highlightedIndex].name)
                    return
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setInputValue('')
                    return
                  }
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
        accept="image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.yaml,.yml,.csv,.xml,.html,.htm,.css,.py,.rs,.go,.java,.rb,.sh,.bash,.zsh,.toml,.ini,.graphql,.sql,.vue,.svelte,.c,.cpp,.h,.hpp,.cs,.kt,.swift"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
