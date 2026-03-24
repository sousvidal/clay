import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import type {
  ContentBlock,
  ToolCall,
  SubAgentMessage,
  Turn,
  UserAttachment,
  ParsedSession,
  TokenUsage,
  UserQuestionBlock,
  UserQuestionItem,
} from './webview/lib/types'

// ── Raw JSONL message types ─────────────────────────────────────────

interface RawMessage {
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

// ── Helpers ─────────────────────────────────────────────────────────

const METADATA_TAG_PATTERN =
  /<(?:system-reminder|task-notification|local-command-caveat|command-name|command-message|command-args|teammate-message|env|local-command-stdout|local-command-stderr|claude_background_info|fast_mode_info|gitStatus|available-deferred-tools|new-diagnostics)>[\s\S]*?<\/(?:system-reminder|task-notification|local-command-caveat|command-name|command-message|command-args|teammate-message|env|local-command-stdout|local-command-stderr|claude_background_info|fast_mode_info|gitStatus|available-deferred-tools|new-diagnostics)>/g

function stripMetadataTags(text: string): string {
  return text.replace(METADATA_TAG_PATTERN, '').trim()
}

function extractUserText(msg: RawMessage): string | null {
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

function extractUserAttachments(msg: RawMessage): UserAttachment[] {
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

function extractAssistantBlocks(msg: RawMessage): ContentBlock[] {
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
        if (block.name === 'AskUserQuestion') {
          const input = (block.input as Record<string, unknown>) ?? {}
          let questions: UserQuestionItem[]
          if (Array.isArray(input.questions)) {
            // New format: { questions: [{ question, header, options, multiSelect }] }
            questions = (input.questions as Record<string, unknown>[]).map((q) => ({
              question: String(q.question ?? ''),
              header: String(q.header ?? ''),
              options: Array.isArray(q.options)
                ? (q.options as Record<string, unknown>[]).map((o) => ({
                    label: String(o.label ?? ''),
                    description: String(o.description ?? ''),
                  }))
                : [],
              multiSelect: Boolean(q.multiSelect),
            }))
          } else {
            // Old flat format: { question, options, multiSelect }
            const rawOptions = Array.isArray(input.options) ? input.options : []
            questions = [
              {
                question: String(input.question ?? ''),
                header: '',
                options: (rawOptions as Record<string, unknown>[]).map((o) => ({
                  label: String(o.label ?? ''),
                  description: String(o.description ?? ''),
                })),
                multiSelect: Boolean(input.multiSelect),
              },
            ]
          }
          const qBlock: UserQuestionBlock = {
            kind: 'user_question',
            toolCallId: block.id as string,
            questions,
            status: 'pending',
          }
          blocks.push(qBlock)
        } else {
          blocks.push({
            kind: 'tool_call',
            toolCall: {
              id: block.id as string,
              name: block.name as string,
              input: (block.input as Record<string, unknown>) ?? {},
              status: 'done',
            },
          })
        }
        break
    }
  }

  return blocks
}

function extractTokenUsage(msg: RawMessage): TokenUsage | null {
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

function mergeTokenUsage(a: TokenUsage | null, b: TokenUsage | null): TokenUsage | null {
  if (!a) return b
  if (!b) return a
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: (a.cacheReadTokens ?? 0) + (b.cacheReadTokens ?? 0) || undefined,
    cacheCreationTokens: (a.cacheCreationTokens ?? 0) + (b.cacheCreationTokens ?? 0) || undefined,
  }
}

function isToolResultOnly(msg: RawMessage): boolean {
  const message = msg.message as { content?: unknown } | undefined
  if (!message?.content || !Array.isArray(message.content)) return false
  const content = message.content as Array<{ type: string }>
  return content.length > 0 && content.every((b) => b.type === 'tool_result')
}

function extractToolResults(msg: RawMessage): Map<string, { result: string; isError: boolean }> {
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

function extractTextFromContent(content: unknown): string[] {
  if (!Array.isArray(content)) return []
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
}

// ── Sub-agent accumulator ───────────────────────────────────────────

interface AgentAccumulator {
  agentId: string
  agentName: string | null
  subagentType: string | null
  text: string[]
  toolCalls: ToolCall[]
  pendingToolCalls: Map<string, ToolCall>
  thinking: string[]
  timestamp: string
  model: string | null
  isBackground: boolean
}

function createAccumulator(
  agentId: string,
  taskMeta: { name: string | null; subagentType: string | null } | undefined,
  isBackground: boolean,
  timestamp: string,
): AgentAccumulator {
  return {
    agentId,
    agentName: taskMeta?.name ?? null,
    subagentType: taskMeta?.subagentType ?? null,
    text: [],
    toolCalls: [],
    pendingToolCalls: new Map(),
    thinking: [],
    timestamp,
    model: null,
    isBackground,
  }
}

function processAgentProgress(acc: AgentAccumulator, data: Record<string, unknown>): void {
  const innerMessage = data.message as Record<string, unknown> | undefined
  if (!innerMessage) return

  const msgType = innerMessage.type as string
  const innerMsg = innerMessage.message as Record<string, unknown> | undefined
  if (!innerMsg) return

  if (msgType === 'assistant') {
    if (innerMsg.model && !acc.model) {
      acc.model = innerMsg.model as string
    }

    const innerContent = innerMsg.content
    if (!Array.isArray(innerContent)) return

    for (const block of innerContent as Array<Record<string, unknown>>) {
      if (
        block.type === 'thinking' &&
        typeof block.thinking === 'string' &&
        block.thinking.length > 0
      ) {
        acc.thinking.push(block.thinking)
      } else if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 0) {
        acc.text.push(block.text)
      } else if (block.type === 'tool_use') {
        const tc: ToolCall = {
          id: block.id as string,
          name: block.name as string,
          input: (block.input as Record<string, unknown>) ?? {},
          status: 'done',
        }
        acc.toolCalls.push(tc)
        acc.pendingToolCalls.set(block.id as string, tc)
      }
    }
  } else if (msgType === 'user') {
    const innerContent = innerMsg.content
    if (!Array.isArray(innerContent)) return

    for (const block of innerContent as Array<Record<string, unknown>>) {
      if (block.type !== 'tool_result') continue
      const toolUseId = block.tool_use_id as string
      const pending = acc.pendingToolCalls.get(toolUseId)
      if (pending) {
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
        pending.result = resultText
        pending.isError = isError
        acc.pendingToolCalls.delete(toolUseId)
      }
    }
  }
}

/**
 * Read the sub-agent's own JSONL file for full conversation details.
 */
function readSubAgentJsonl(
  sessionJsonlPath: string,
  agentId: string,
): { text: string[]; toolCalls: ToolCall[]; thinking: string[]; model: string | null } | null {
  const sessionDir = sessionJsonlPath.replace('.jsonl', '')
  const agentJsonl = path.join(sessionDir, 'subagents', `agent-${agentId}.jsonl`)

  if (!fs.existsSync(agentJsonl)) return null

  const text: string[] = []
  const toolCalls: ToolCall[] = []
  const pendingTc = new Map<string, ToolCall>()
  const thinking: string[] = []
  let model: string | null = null

  try {
    const raw = fs.readFileSync(agentJsonl, 'utf-8')
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line) as Record<string, unknown>
        const message = msg.message as Record<string, unknown> | undefined
        if (!message?.content) continue

        if (!model && message.model) {
          model = message.model as string
        }

        const content = message.content
        if (!Array.isArray(content)) continue

        const role = message.role as string
        if (role === 'assistant') {
          for (const block of content as Array<Record<string, unknown>>) {
            if (
              block.type === 'thinking' &&
              typeof block.thinking === 'string' &&
              block.thinking.length > 0
            ) {
              thinking.push(block.thinking)
            } else if (
              block.type === 'text' &&
              typeof block.text === 'string' &&
              block.text.length > 0
            ) {
              text.push(block.text)
            } else if (block.type === 'tool_use') {
              const tc: ToolCall = {
                id: block.id as string,
                name: block.name as string,
                input: (block.input as Record<string, unknown>) ?? {},
                status: 'done',
              }
              toolCalls.push(tc)
              pendingTc.set(block.id as string, tc)
            }
          }
        } else if (role === 'user') {
          for (const block of content as Array<Record<string, unknown>>) {
            if (block.type !== 'tool_result') continue
            const tc = pendingTc.get(block.tool_use_id as string)
            if (tc) {
              let resultText = ''
              if (typeof block.content === 'string') {
                resultText = block.content
              } else if (Array.isArray(block.content)) {
                resultText = (block.content as Array<{ type: string; text?: string }>)
                  .filter((b) => b.type === 'text' && b.text)
                  .map((b) => b.text!)
                  .join('\n')
              }
              tc.result = resultText
              tc.isError = (block.is_error as boolean) ?? false
              pendingTc.delete(block.tool_use_id as string)
            }
          }
        }
      } catch {
        // skip
      }
    }
  } catch {
    return null
  }

  return { text, toolCalls, thinking, model }
}

/**
 * Read the sub-agent meta.json for type and description.
 */
function readSubAgentMeta(
  sessionJsonlPath: string,
  agentId: string,
): { agentType: string | null; description: string | null } {
  const sessionDir = sessionJsonlPath.replace('.jsonl', '')
  const metaPath = path.join(sessionDir, 'subagents', `agent-${agentId}.meta.json`)

  try {
    const raw = fs.readFileSync(metaPath, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>
    return {
      agentType: (data.agentType as string) ?? null,
      description: (data.description as string) ?? null,
    }
  } catch {
    return { agentType: null, description: null }
  }
}

function finishAccumulator(acc: AgentAccumulator, sessionJsonlPath: string): SubAgentMessage {
  const rich = readSubAgentJsonl(sessionJsonlPath, acc.agentId)
  const meta = readSubAgentMeta(sessionJsonlPath, acc.agentId)

  const source = rich ?? acc

  return {
    agentId: acc.agentId,
    agentName: meta.description ?? acc.agentName,
    subagentType: meta.agentType ?? acc.subagentType,
    text: source.text,
    toolCalls: source.toolCalls,
    thinking: source.thinking,
    timestamp: acc.timestamp,
    model: source.model ?? acc.model,
    isBackground: acc.isBackground,
    status: 'completed',
  }
}

// ── Main parser ─────────────────────────────────────────────────────

export async function parseSessionFile(jsonlPath: string): Promise<ParsedSession> {
  const messages: RawMessage[] = []

  const stream = fs.createReadStream(jsonlPath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  try {
    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        messages.push(JSON.parse(line) as RawMessage)
      } catch {
        // skip malformed lines
      }
    }
  } finally {
    rl.close()
    stream.destroy()
  }

  // Session metadata (extracted from system:init)
  let sessionId = ''
  let metaModel: string | null = null
  let gitBranch: string | null = null
  let cwd: string | null = null
  let version: string | null = null

  // Build turns
  const turns: Turn[] = []
  let currentTurn: Turn | null = null
  const pendingToolCalls = new Map<string, ToolCall>()
  const pendingQuestions = new Map<string, UserQuestionBlock>()

  // Agent/Task tracking
  const taskMetaMap = new Map<string, { name: string | null; subagentType: string | null }>()
  const backgroundIds = new Set<string>()
  const agentAccumulators = new Map<string, AgentAccumulator>()
  // Track seen token UUIDs per-turn to avoid double-counting on re-parse
  const seenTokenUuids = new Set<string>()

  function flushAgent(parentId: string): void {
    const acc = agentAccumulators.get(parentId)
    if (!acc) return

    const finished = finishAccumulator(acc, jsonlPath)

    if (
      finished.text.length === 0 &&
      finished.toolCalls.length === 0 &&
      finished.thinking.length === 0
    ) {
      agentAccumulators.delete(parentId)
      return
    }

    if (currentTurn) {
      currentTurn.contentBlocks.push({
        kind: 'sub_agent',
        messages: [finished],
        isBackground: acc.isBackground,
      })
    }
    agentAccumulators.delete(parentId)
  }

  function flushAllAgents(): void {
    for (const parentId of agentAccumulators.keys()) {
      flushAgent(parentId)
    }
  }

  for (const msg of messages) {
    if (msg.isSidechain) continue
    if (
      msg.type === 'file-history-snapshot' ||
      msg.type === 'queue-operation' ||
      msg.type === 'last-prompt'
    ) {
      continue
    }

    // System messages — extract metadata from init
    if (msg.type === 'system') {
      if (msg.subtype === 'init') {
        sessionId = (msg.sessionId as string) ?? sessionId
        version = (msg.version as string) ?? version
        gitBranch =
          ((msg.git as Record<string, unknown>)?.branch as string) ??
          (msg.gitBranch as string) ??
          gitBranch
        cwd = (msg.cwd as string) ?? cwd
        metaModel = (msg.model as string) ?? metaModel
      }
      if ((msg.subtype === 'compact_boundary' || msg.compactMetadata) && currentTurn) {
        const summary = msg.summary ?? 'Context compacted'
        currentTurn.contentBlocks.push({
          kind: 'compaction',
          summary: typeof summary === 'string' ? summary : 'Context compacted',
        })
      }
      if (msg.durationMs && currentTurn) {
        currentTurn.durationMs = msg.durationMs
      }
      continue
    }

    // Summary messages (compaction)
    if (msg.type === 'summary' && msg.summary && currentTurn) {
      currentTurn.contentBlocks.push({
        kind: 'compaction',
        summary: msg.summary,
      })
      continue
    }

    // Progress messages — old-format sub-agent activity
    if (msg.type === 'progress' && currentTurn) {
      const data = msg.data
      if (data && (data.type as string) === 'agent_progress') {
        const parentId = (msg.parentToolUseID as string) ?? ''
        const agentId = (data.agentId as string) ?? ''

        if (!agentAccumulators.has(parentId)) {
          const taskMeta = taskMetaMap.get(parentId)
          const isBackground = backgroundIds.has(parentId)
          agentAccumulators.set(
            parentId,
            createAccumulator(agentId, taskMeta, isBackground, (msg.timestamp as string) ?? ''),
          )
        }

        processAgentProgress(agentAccumulators.get(parentId)!, data)
      }
      continue
    }

    // User messages
    if (msg.type === 'user' && !msg.isMeta) {
      // New-format sub-agent result (toolUseResult)
      if (msg.toolUseResult && currentTurn) {
        const tur = msg.toolUseResult as Record<string, unknown>
        if (tur.agentId) {
          const content = (msg.message as { content?: unknown[] })?.content as
            | Array<Record<string, unknown>>
            | undefined
          const toolResultBlock = content?.find((b) => b.type === 'tool_result')
          const parentId = (toolResultBlock?.tool_use_id as string) ?? ''

          flushAgent(parentId)

          const taskMeta = taskMetaMap.get(parentId)
          const isBackground = backgroundIds.has(parentId)
          const text = extractTextFromContent(tur.content)

          const agentMsg: SubAgentMessage = {
            agentId: (tur.agentId as string) ?? '',
            agentName: taskMeta?.name ?? null,
            subagentType: taskMeta?.subagentType ?? null,
            text,
            toolCalls: [],
            thinking: [],
            timestamp: (msg.timestamp as string) ?? '',
            model: null,
            isBackground,
            prompt: tur.prompt as string | undefined,
            status: (tur.status as string) ?? 'completed',
            durationMs: tur.totalDurationMs as number | undefined,
            toolUseCount: tur.totalToolUseCount as number | undefined,
          }

          // Enrich with tool calls / thinking from the subagent's own JSONL
          const rich = readSubAgentJsonl(jsonlPath, agentMsg.agentId)
          const subMeta = readSubAgentMeta(jsonlPath, agentMsg.agentId)
          if (rich) {
            agentMsg.toolCalls = rich.toolCalls
            agentMsg.thinking = rich.thinking
            // Keep agentMsg.text from tur.content — that IS the final result
          }
          if (subMeta.description) agentMsg.agentName = subMeta.description
          if (subMeta.agentType) agentMsg.subagentType = subMeta.agentType

          currentTurn.contentBlocks.push({
            kind: 'sub_agent',
            messages: [agentMsg],
            isBackground,
          })

          // Attach tool result to pending tool call
          const results = extractToolResults(msg)
          for (const [toolId, result] of results) {
            const pending = pendingToolCalls.get(toolId)
            if (pending) {
              pending.result = result.result
              pending.isError = result.isError
              pendingToolCalls.delete(toolId)
            }
          }
          continue
        }
      }

      // Regular tool results
      if (isToolResultOnly(msg)) {
        const results = extractToolResults(msg)
        for (const [toolId, result] of results) {
          const pending = pendingToolCalls.get(toolId)
          if (pending) {
            pending.result = result.result
            pending.isError = result.isError
            pendingToolCalls.delete(toolId)
          }
          const pendingQ = pendingQuestions.get(toolId)
          if (pendingQ) {
            pendingQ.status = 'answered'
            pendingQuestions.delete(toolId)
          }
        }
        continue
      }

      // Start a new turn — flush any pending agents first
      flushAllAgents()

      if (currentTurn) {
        turns.push(currentTurn)
      }

      // Extract session ID from first user message if not set by system:init
      if (!sessionId && msg.sessionId) {
        sessionId = msg.sessionId as string
      }

      currentTurn = {
        id: (msg.uuid as string) ?? `turn-${turns.length}`,
        userMessage: extractUserText(msg),
        userAttachments: extractUserAttachments(msg),
        contentBlocks: [],
        timestamp: (msg.timestamp as string) ?? '',
        durationMs: null,
        model: null,
        tokenUsage: null,
      }
      continue
    }

    // Assistant messages
    if (msg.type === 'assistant' && currentTurn) {
      flushAllAgents()

      const blocks = extractAssistantBlocks(msg)

      for (const block of blocks) {
        if (block.kind === 'tool_call') {
          const tc = block.toolCall
          pendingToolCalls.set(tc.id, tc)

          if (tc.name === 'Agent' || tc.name === 'Task') {
            const input = tc.input
            taskMetaMap.set(tc.id, {
              name: (input.description as string) ?? (input.name as string) ?? null,
              subagentType: (input.subagent_type as string) ?? null,
            })
            if (input.run_in_background === true) {
              backgroundIds.add(tc.id)
            }
          }
        } else if (block.kind === 'user_question') {
          pendingQuestions.set(block.toolCallId, block)
        }
      }

      const filteredBlocks = blocks.filter(
        (b) =>
          !(b.kind === 'tool_call' && (b.toolCall.name === 'Agent' || b.toolCall.name === 'Task')),
      )
      currentTurn.contentBlocks.push(...filteredBlocks)

      const message = msg.message as { model?: string } | undefined
      if (message?.model && !currentTurn.model) {
        currentTurn.model = message.model
      }

      // Accumulate token usage, deduplicating by uuid
      if (msg.uuid && !seenTokenUuids.has(msg.uuid)) {
        seenTokenUuids.add(msg.uuid)
        const usage = extractTokenUsage(msg)
        if (usage) {
          currentTurn.tokenUsage = mergeTokenUsage(currentTurn.tokenUsage, usage)
        }
      }

      continue
    }
  }

  // Flush remaining agents and last turn
  flushAllAgents()
  if (currentTurn) {
    turns.push(currentTurn)
  }

  // Mark any tool calls that never received a result as 'running' — they are
  // still awaiting output (e.g. AskUserQuestion waiting for the user to reply).
  for (const tc of pendingToolCalls.values()) {
    tc.status = 'running'
  }

  const filteredTurns = turns.filter((t) => t.userMessage !== null || t.contentBlocks.length > 0)

  return {
    sessionId,
    model: metaModel,
    gitBranch,
    cwd,
    version,
    turns: filteredTurns,
  }
}
