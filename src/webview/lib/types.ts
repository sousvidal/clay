export interface TextBlock {
  kind: 'text'
  text: string
}

export interface ThinkingBlock {
  kind: 'thinking'
  text: string
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  isError?: boolean
  status: 'running' | 'done'
}

export interface ToolCallBlock {
  kind: 'tool_call'
  toolCall: ToolCall
}

export interface SubAgentMessage {
  agentId: string
  agentName: string | null
  subagentType: string | null
  text: string[]
  toolCalls: ToolCall[]
  thinking: string[]
  timestamp: string
  model: string | null
  isBackground: boolean
  prompt?: string
  status?: string
  durationMs?: number
  toolUseCount?: number
}

export interface SubAgentBlock {
  kind: 'sub_agent'
  messages: SubAgentMessage[]
  isBackground: boolean
}

export interface CompactionBlock {
  kind: 'compaction'
  summary: string
}

export interface SystemMessageBlock {
  kind: 'system_message'
  text: string
  level: 'info' | 'warning'
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolCallBlock
  | SubAgentBlock
  | CompactionBlock
  | SystemMessageBlock

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

export interface UserAttachment {
  name: string // filename for docs; empty string for bare images
  mediaType: string // e.g. 'image/png', 'application/pdf', 'text/plain'
  data: string // base64 for images/PDFs; raw text for text docs
  isImage: boolean
}

export interface Turn {
  id: string
  userMessage: string | null
  userAttachments: UserAttachment[]
  contentBlocks: ContentBlock[]
  timestamp: string
  durationMs: number | null
  model: string | null
  tokenUsage: TokenUsage | null
}

export interface Attachment {
  id: string
  name: string
  mediaType: string
  data: string // base64 for binary; raw text for text files
  isText: boolean
  previewUrl?: string // object URL for images (webview only, not serialised)
}

export interface SessionMeta {
  sessionId: string
  model: string | null
  gitBranch: string | null
  cwd: string | null
  version: string | null
}

export interface ParsedSession extends SessionMeta {
  turns: Turn[]
}

export interface SlashCommand {
  name: string
  description: string
}

export interface WorkspaceFile {
  path: string
  relativePath: string
  name: string
  isDirectory: boolean
}

export interface PermissionRequest {
  requestId: string
  sessionId: string
  toolName: string
  toolInput: Record<string, unknown>
}
