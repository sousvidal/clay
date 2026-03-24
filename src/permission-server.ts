import * as http from 'http'
import * as crypto from 'crypto'

const PERMISSION_PORT = parseInt(process.env.PERMISSION_PORT ?? '0', 10)
const SESSION_ID = process.env.SESSION_ID ?? ''

// ── MCP stdio transport ───────────────────────────────────────────────

let buffer = ''

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      try {
        handleMessage(JSON.parse(trimmed) as JsonRpcMessage)
      } catch {
        // ignore malformed JSON
      }
    }
  }
})

process.stdin.on('end', () => {
  process.exit(0)
})

interface JsonRpcMessage {
  jsonrpc: string
  id?: number | string
  method?: string
  params?: unknown
}

function send(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function handleMessage(msg: JsonRpcMessage): void {
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'clay-permissions', version: '1.0.0' },
      },
    })
    return
  }

  if (msg.method === 'notifications/initialized' || msg.method === 'initialized') {
    return // notification, no response
  }

  if (msg.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: [
          {
            name: 'prompt_for_permission',
            description: 'Ask the user whether to allow a tool call',
            inputSchema: {
              type: 'object',
              properties: {
                tool_name: { type: 'string' },
                tool_input: { type: 'object' },
              },
              required: ['tool_name'],
            },
          },
        ],
      },
    })
    return
  }

  if (msg.method === 'tools/call') {
    const params = msg.params as {
      name: string
      arguments: { tool_name: string; tool_input?: Record<string, unknown> }
    }
    const requestId = crypto.randomUUID()
    askExtension(requestId, params.arguments.tool_name, params.arguments.tool_input ?? {})
      .then((allow) => {
        send({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            content: [{ type: 'text', text: allow ? 'allow' : 'deny' }],
          },
        })
      })
      .catch(() => {
        // On timeout or error, deny for safety
        send({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            content: [{ type: 'text', text: 'deny' }],
          },
        })
      })
    return
  }

  // Unknown method — send method-not-found error if it has an id
  if (msg.id !== undefined) {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: 'Method not found' },
    })
  }
}

// ── HTTP long-poll to extension ───────────────────────────────────────

function askExtension(
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ requestId, sessionId: SESSION_ID, toolName, toolInput })

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: PERMISSION_PORT,
      path: '/permission',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as { allow: boolean }
          resolve(parsed.allow)
        } catch {
          reject(new Error('Invalid response from permission server'))
        }
      })
    })

    // 310 seconds — slightly longer than the extension's 300 s timeout so the
    // extension always wins the race and we get a clean deny rather than a socket error.
    req.setTimeout(310_000, () => {
      req.destroy()
      reject(new Error('Permission request timed out'))
    })

    req.on('error', reject)

    req.write(body)
    req.end()
  })
}
