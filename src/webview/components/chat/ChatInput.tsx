import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Loader2, Paperclip, Image as ImageIcon, FileText, X, Square } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Attachment, SlashCommand, WorkspaceFile, UserAttachment } from '../../lib/types'
import { vscodeApi } from '../../lib/vscode'
import { isImageType, readFileAsAttachment } from './conversation-utils'
import { ModelSelector } from './ModelSelector'
import { SlashAutocomplete, FileAutocomplete } from './AutocompletePopup'

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

  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [model, setModel] = useState<string>('sonnet')
  const [effort, setEffort] = useState<string | null>(null)
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

  function handleKeyDown(e: React.KeyboardEvent): void {
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
  }

  const canSend = !sending && (inputValue.trim().length > 0 || attachments.length > 0)

  const fileAccept =
    'image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.yaml,.yml,.csv,.xml,.html,.htm,.css,.py,.rs,.go,.java,.rb,.sh,.bash,.zsh,.toml,.ini,.graphql,.sql,.vue,.svelte,.c,.cpp,.h,.hpp,.cs,.kt,.swift'

  return (
    <>
      <div className="relative mx-auto w-full max-w-5xl shrink-0 px-4 pb-3 pt-2">
        <SlashAutocomplete
          commands={filteredCommands}
          highlightedIndex={highlightedIndex}
          onSelect={selectCommand}
        />
        <FileAutocomplete
          files={filteredFiles}
          highlightedIndex={fileHighlightedIndex}
          onSelect={selectFile}
        />
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

            <ModelSelector
              model={model}
              effort={effort}
              planMode={planMode}
              onModelChange={setModel}
              onEffortChange={setEffort}
              onTogglePlanMode={onTogglePlanMode}
            />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
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
