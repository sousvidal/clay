// Content block types that can appear within a message
export interface TextBlock {
  kind: 'text'
  text: string
}

export interface ThinkingBlock {
  kind: 'thinking'
  text: string
}

export interface CodeBlock {
  kind: 'code'
  language: string
  code: string
  filename?: string
}

export interface ToolCall {
  kind: 'tool_call'
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  isError?: boolean
  status: 'running' | 'done'
}

export interface ImageBlock {
  kind: 'image'
  alt: string
  url: string
}

export interface SubAgentBlock {
  kind: 'sub_agent'
  agentName: string
  subagentType: string
  prompt: string
  status: 'running' | 'done'
  text?: string
  toolCalls?: ToolCall[]
  durationMs?: number
}

export interface CompactionMarker {
  kind: 'compaction'
  turnsCompacted: number
  summary: string
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | CodeBlock
  | ToolCall
  | ImageBlock
  | SubAgentBlock
  | CompactionMarker

export interface ConversationMessage {
  id: string
  role: 'assistant' | 'user' | 'system'
  blocks: ContentBlock[]
  isStreaming?: boolean
  model?: string
  durationMs?: number
}

export const mockConversation: ConversationMessage[] = [
  // User message
  {
    id: '1',
    role: 'user',
    blocks: [
      {
        kind: 'text',
        text: 'Can you refactor the auth middleware to separate token validation from session management?',
      },
    ],
  },
  // Assistant with thinking + tool reads
  {
    id: '2',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    durationMs: 4200,
    blocks: [
      {
        kind: 'thinking',
        text: 'The user wants to split auth middleware into two concerns. Let me first read the current implementation to understand the existing code structure before making changes.',
      },
      {
        kind: 'text',
        text: "I'll start by reading the current auth middleware to understand the existing implementation.",
      },
      {
        kind: 'tool_call',
        id: 't1',
        name: 'Read',
        input: { file_path: 'src/middleware/auth.ts' },
        result: '47 lines',
        status: 'done',
      },
      {
        kind: 'tool_call',
        id: 't2',
        name: 'Read',
        input: { file_path: 'src/lib/session.ts' },
        result: '23 lines',
        status: 'done',
      },
    ],
  },
  // Assistant with code block + edit/write tools
  {
    id: '3',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    durationMs: 8900,
    blocks: [
      {
        kind: 'text',
        text: "The auth middleware currently handles both concerns in a single function. I'll split this into two focused middleware functions:\n\n1. `validateToken` — verifies the JWT and attaches the decoded payload\n2. `manageSession` — handles session creation, renewal, and cleanup",
      },
      {
        kind: 'code',
        language: 'typescript',
        filename: 'src/middleware/validate-token.ts',
        code: `export async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }

  try {
    const payload = await verifyJWT(token)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}`,
      },
      {
        kind: 'tool_call',
        id: 't3',
        name: 'Edit',
        input: {
          file_path: 'src/middleware/auth.ts',
          old_string: 'export async function authMiddleware',
          new_string: 'export async function validateToken',
        },
        result: '32 lines changed',
        status: 'done',
      },
      {
        kind: 'tool_call',
        id: 't4',
        name: 'Write',
        input: { file_path: 'src/middleware/session.ts', content: '...' },
        result: 'Created',
        status: 'done',
      },
    ],
  },
  // Assistant running Bash
  {
    id: '4',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    durationMs: 3100,
    blocks: [
      { kind: 'text', text: 'Let me run the tests to make sure everything still passes.' },
      {
        kind: 'tool_call',
        id: 't5',
        name: 'Bash',
        input: { command: 'npm test -- --filter auth' },
        result:
          '✓ validateToken returns 401 without header\n✓ validateToken attaches payload\n✓ manageSession creates new session\n✓ manageSession renews expired session\n\nTests: 4 passed, 0 failed',
        status: 'done',
      },
    ],
  },
  // User follow-up
  {
    id: '5',
    role: 'user',
    blocks: [
      {
        kind: 'text',
        text: 'Looks good. Can you also update the route handlers that use the old middleware?',
      },
    ],
  },
  // Assistant with grep + sub-agent
  {
    id: '6',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    blocks: [
      {
        kind: 'text',
        text: "I'll find all files that import the old middleware and update them. Let me also launch a sub-agent to update the tests in parallel.",
      },
      {
        kind: 'tool_call',
        id: 't6',
        name: 'Grep',
        input: { pattern: 'authMiddleware', path: 'src/routes/' },
        result:
          'src/routes/users.ts\nsrc/routes/admin.ts\nsrc/routes/api.ts\nsrc/routes/webhook.ts',
        status: 'done',
      },
      {
        kind: 'sub_agent',
        agentName: 'Update auth tests',
        subagentType: 'general-purpose',
        prompt:
          'Update all test files that reference authMiddleware to use the new validateToken and manageSession functions',
        status: 'done',
        text: 'Updated 3 test files to use the new middleware functions.',
        toolCalls: [
          {
            kind: 'tool_call',
            id: 'sa1',
            name: 'Edit',
            input: { file_path: 'tests/auth.test.ts' },
            result: '12 lines changed',
            status: 'done',
          },
        ],
        durationMs: 6200,
      },
      {
        kind: 'tool_call',
        id: 't7',
        name: 'Edit',
        input: { file_path: 'src/routes/users.ts' },
        status: 'running',
      },
    ],
    isStreaming: true,
  },
  // System message — compaction
  {
    id: '7',
    role: 'system',
    blocks: [
      {
        kind: 'compaction',
        turnsCompacted: 12,
        summary: '12 turns compacted. Context reduced from 89k to 24k tokens.',
      },
    ],
  },
  // Assistant with error result
  {
    id: '8',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    durationMs: 2300,
    blocks: [
      {
        kind: 'text',
        text: 'Let me verify the build passes after all the changes.',
      },
      {
        kind: 'tool_call',
        id: 't8',
        name: 'Bash',
        input: { command: 'npm run build' },
        result:
          "error TS2345: Argument of type 'string' is not assignable to parameter of type 'AuthPayload'.\n  src/routes/admin.ts:14:25",
        isError: true,
        status: 'done',
      },
      {
        kind: 'text',
        text: "There's a type error in the admin routes. The `req.user` type needs to be updated. Let me fix that.",
      },
      {
        kind: 'tool_call',
        id: 't9',
        name: 'Edit',
        input: {
          file_path: 'src/routes/admin.ts',
          old_string: 'const user: string = req.user',
          new_string: 'const user: AuthPayload = req.user',
        },
        result: '1 line changed',
        status: 'done',
      },
    ],
  },
]
