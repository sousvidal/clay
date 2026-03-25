import * as fs from 'fs'
import * as readline from 'readline'
import type {
  ToolCall,
  SubAgentMessage,
  Turn,
  ParsedSession,
  UserQuestionBlock,
} from './webview/lib/types'
import {
  extractUserText,
  extractUserAttachments,
  extractAssistantBlocks,
  extractTokenUsage,
  mergeTokenUsage,
  isToolResultOnly,
  extractToolResults,
  extractTextFromContent,
} from './parser/message-helpers'
import type { RawMessage } from './parser/message-helpers'
import {
  createAccumulator,
  processAgentProgress,
  finishAccumulator,
  readSubAgentJsonl,
  readSubAgentMeta,
} from './parser/subagent-helpers'
import type { AgentAccumulator } from './parser/subagent-helpers'

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
