import type { ContentBlock, UserAttachment, TokenUsage } from '../webview/lib/types'

// ── Raw JSONL message types ─────────────────────────────────────────

export interface RawMessage {
  type: string
  uuid?: string
  parentUuid?: string | null
  parentToolUseID?: string
  timestamp?: string
  isSidechain?: boolean
  message?: Record<string, unknown>
  data?: Record<string, unknown>
  isMeta?: boolean
  subtype?: string
  compactMetadata?: { trigger: string; preTokens: number }
  summary?: string
  toolUseResult?: Record<string, unknown>
  durationMs?: number
  sessionId?: string
  [key: string]: unknown
}

// ── Text extraction ─────────────────────────────────────────────────

const METADATA_TAG_PATTERN =
  /<(?:system-reminder|task-notification|local-command-caveat|command-name|command-message|command-args|teammate-message|env|local-command-stdout|local-command-stderr|claude_background_info|fast_mode_info|gitStatus|available-deferred-tools|new-diagnostics)>[\s\S]*?<\/(?:system-reminder|task-notification|local-command-caveat|command-name|command-message|command-args|teammate-message|env|local-command-stdout|local-command-stderr|claude_background_info|fast_mode_info|gitStatus|available-deferred-tools|new-diagnostics)>/g

export function stripMetadataTags(text: string): string {
  return text.replace(METADATA_TAG_PATTERN, '').trim()
}

export function extractUserText(msg: RawMessage): string | null {
  const message = msg.message as { content?: unknown } | undefined
  if (!message?.content) return null

  const content = message.content
  if (typeof content === 'string') {
    const cleaned = stripMetadataTags(content)
    return cleaned.length > 0 ? cleaned : null
  }
  if (Array.isArray(content)) {
    const parts = (content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => stripMetadataTags(b.text!))
      .filter((t) => t.length > 0)
    return parts.length > 0 ? parts.join('\n\n') : null
  }
  return null
}

// ── Attachment extraction ───────────────────────────────────────────

export function extractUserAttachments(msg: RawMessage): UserAttachment[] {
  const message = msg.message as { content?: unknown } | undefined
  if (!message?.content || !Array.isArray(message.content)) return []

  const attachments: UserAttachment[] = []
  for (const block of message.content as Array<Record<string, unknown>>) {
    if (block.type === 'image') {
      const source = block.source as Record<string, unknown> | undefined
      if (source?.type === 'base64') {
        attachments.push({
          name: '',
          mediaType: (source.media_type as string) ?? 'image/png',
          data: (source.data as string) ?? '',
          isImage: true,
        })
      }
    } else if (block.type === 'document') {
      const source = block.source as Record<string, unknown> | undefined
      const title = (block.title as string) ?? ''
      if (source?.type === 'base64') {
        attachments.push({
          name: title,
          mediaType: (source.media_type as string) ?? 'application/octet-stream',
          data: (source.data as string) ?? '',
          isImage: false,
        })
      } else if (source?.type === 'text') {
        attachments.push({
          name: title,
          mediaType: (source.media_type as string) ?? 'text/plain',
          data: (source.data as string) ?? '',
          isImage: false,
        })
      }
    }
  }
  return attachments
}

// ── Assistant block extraction ──────────────────────────────────────

export function extractAssistantBlocks(msg: RawMessage): ContentBlock[] {
  const message = msg.message as { content?: unknown } | undefined
  if (!message?.content || !Array.isArray(message.content)) return []

  const blocks: ContentBlock[] = []
  const contentArr = message.content as Array<Record<string, unknown>>

  for (const block of contentArr) {
    switch (block.type) {
      case 'thinking':
        if (block.thinking && typeof block.thinking === 'string' && block.thinking.length > 0) {
          blocks.push({ kind: 'thinking', text: block.thinking })
        }
        break
      case 'text':
        if (block.text && typeof block.text === 'string' && block.text.length > 0) {
          blocks.push({ kind: 'text', text: block.text })
        }
        break
      case 'tool_use':
        blocks.push({
          kind: 'tool_call',
          toolCall: {
            id: block.id as string,
            name: block.name as string,
            input: (block.input as Record<string, unknown>) ?? {},
            status: 'done',
          },
        })
        break
    }
  }

  return blocks
}

// ── Token usage ─────────────────────────────────────────────────────

export function extractTokenUsage(msg: RawMessage): TokenUsage | null {
  const message = msg.message as { usage?: Record<string, unknown> } | undefined
  const usage = message?.usage
  if (!usage) return null

  const inputTokens = (usage.input_tokens as number) ?? 0
  const outputTokens = (usage.output_tokens as number) ?? 0
  if (!inputTokens && !outputTokens) return null

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: (usage.cache_read_input_tokens as number) ?? undefined,
    cacheCreationTokens: (usage.cache_creation_input_tokens as number) ?? undefined,
  }
}

export function mergeTokenUsage(a: TokenUsage | null, b: TokenUsage | null): TokenUsage | null {
  if (!a) return b
  if (!b) return a
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: (a.cacheReadTokens ?? 0) + (b.cacheReadTokens ?? 0) || undefined,
    cacheCreationTokens: (a.cacheCreationTokens ?? 0) + (b.cacheCreationTokens ?? 0) || undefined,
  }
}

// ── Tool results ────────────────────────────────────────────────────

export function isToolResultOnly(msg: RawMessage): boolean {
  const message = msg.message as { content?: unknown } | undefined
  if (!message?.content || !Array.isArray(message.content)) return false
  const content = message.content as Array<{ type: string }>
  return content.length > 0 && content.every((b) => b.type === 'tool_result')
}

export function extractToolResults(
  msg: RawMessage,
): Map<string, { result: string; isError: boolean }> {
  const results = new Map<string, { result: string; isError: boolean }>()
  const message = msg.message as { content?: unknown } | undefined
  if (!message?.content || !Array.isArray(message.content)) return results

  const content = message.content as Array<Record<string, unknown>>
  for (const block of content) {
    if (block.type !== 'tool_result') continue
    const toolUseId = block.tool_use_id as string
    const isError = (block.is_error as boolean) ?? false
    let resultText = ''

    if (typeof block.content === 'string') {
      resultText = block.content
    } else if (Array.isArray(block.content)) {
      resultText = (block.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text!)
        .join('\n')
    }

    results.set(toolUseId, { result: resultText, isError })
  }

  return results
}

export function extractTextFromContent(content: unknown): string[] {
  if (!Array.isArray(content)) return []
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
}
