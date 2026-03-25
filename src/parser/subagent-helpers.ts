import * as fs from 'fs'
import * as path from 'path'
import type { ToolCall, SubAgentMessage } from '../webview/lib/types'

// ── Sub-agent accumulator ───────────────────────────────────────────

export interface AgentAccumulator {
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

export function createAccumulator(
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

export function processAgentProgress(acc: AgentAccumulator, data: Record<string, unknown>): void {
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

// ── Sub-agent JSONL reader ──────────────────────────────────────────

/**
 * Read the sub-agent's own JSONL file for full conversation details.
 */
export function readSubAgentJsonl(
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
export function readSubAgentMeta(
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

export function finishAccumulator(
  acc: AgentAccumulator,
  sessionJsonlPath: string,
): SubAgentMessage {
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
