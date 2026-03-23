export interface ConversationMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  toolCalls?: ToolCall[]
  codeBlock?: CodeBlock
  isStreaming?: boolean
}

export interface ToolCall {
  id: string
  name: string
  args: string
  result?: string
  status: 'running' | 'done'
}

export interface CodeBlock {
  language: string
  code: string
  filename?: string
}

export const mockConversation: ConversationMessage[] = [
  {
    id: '1',
    role: 'user',
    content:
      'Can you refactor the auth middleware to separate token validation from session management?',
  },
  {
    id: '2',
    role: 'assistant',
    content:
      "I'll start by reading the current auth middleware to understand the existing implementation.",
    toolCalls: [
      {
        id: 't1',
        name: 'Read',
        args: 'src/middleware/auth.ts',
        result: '47 lines',
        status: 'done',
      },
      {
        id: 't2',
        name: 'Read',
        args: 'src/lib/session.ts',
        result: '23 lines',
        status: 'done',
      },
    ],
  },
  {
    id: '3',
    role: 'assistant',
    content:
      "The auth middleware currently handles both concerns in a single function. I'll split this into two focused middleware functions:\n\n1. `validateToken` — verifies the JWT and attaches the decoded payload\n2. `manageSession` — handles session creation, renewal, and cleanup\n\nHere's the new token validation middleware:",
    codeBlock: {
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
    toolCalls: [
      {
        id: 't3',
        name: 'Edit',
        args: 'src/middleware/auth.ts',
        result: '32 lines changed',
        status: 'done',
      },
      {
        id: 't4',
        name: 'Write',
        args: 'src/middleware/session.ts',
        result: 'Created',
        status: 'done',
      },
    ],
  },
  {
    id: '4',
    role: 'user',
    content: 'Looks good. Can you also update the route handlers that use the old middleware?',
  },
  {
    id: '5',
    role: 'assistant',
    content:
      "I'll find and update all route files that import the old middleware to use the new separated functions.",
    toolCalls: [
      {
        id: 't5',
        name: 'Grep',
        args: "pattern: 'authMiddleware'",
        result: '4 files',
        status: 'done',
      },
      {
        id: 't6',
        name: 'Edit',
        args: 'src/routes/users.ts',
        status: 'running',
      },
    ],
    isStreaming: true,
  },
]
