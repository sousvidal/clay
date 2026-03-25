import * as http from 'http'
import * as vscode from 'vscode'
import { getBaseCommand } from './shared/shell-utils'
import { openPanels } from './process-manager'

// ── Types ────────────────────────────────────────────────────────────

export interface PendingPermission {
  res: http.ServerResponse
  timer: ReturnType<typeof setTimeout>
}

export interface PendingHookQuestion {
  res: http.ServerResponse
  timer: ReturnType<typeof setTimeout>
  toolInput: Record<string, unknown>
}

// ── State ────────────────────────────────────────────────────────────

export const pendingPermissions = new Map<string, PendingPermission>()
export const pendingHookQuestions = new Map<string, PendingHookQuestion>()
let permissionServer: http.Server | null = null
let permissionPort = 0

export function getPermissionPort(): number {
  return permissionPort
}

// ── Hook helpers ─────────────────────────────────────────────────────

export function hookAllow(res: http.ServerResponse, updatedInput?: Record<string, unknown>): void {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  const output: Record<string, unknown> = {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow',
  }
  if (updatedInput !== undefined) output.updatedInput = updatedInput
  res.end(JSON.stringify({ hookSpecificOutput: output }))
}

export function hookDeny(res: http.ServerResponse, reason = 'User denied'): void {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

// ── Route: PreToolUse ───────────────────────────────────────────────

function handlePreToolUse(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = ''
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString()
  })
  req.on('end', () => {
    try {
      const hookBody = JSON.parse(body) as {
        tool_name: string
        tool_use_id: string
        session_id: string
        tool_input?: Record<string, unknown>
      }
      const payload = {
        requestId: hookBody.tool_use_id || `${Date.now()}`,
        sessionId: hookBody.session_id,
        toolName: hookBody.tool_name,
        toolInput: hookBody.tool_input ?? {},
      }

      // AskUserQuestion: hold the hook response open, show our custom question
      // UI in the webview, and deliver the answer via stdin when the user responds.
      // We block the hook (preventing Claude from continuing) until the user answers.
      if (payload.toolName === 'AskUserQuestion') {
        const panel = openPanels.get(payload.sessionId)
        if (!panel) {
          hookDeny(res, 'No active panel')
          return
        }

        const timer = setTimeout(() => {
          pendingHookQuestions.delete(payload.requestId)
          try {
            hookDeny(res, 'Timed out waiting for user answer')
          } catch {
            // socket may already be gone
          }
        }, 3_600_000)

        pendingHookQuestions.set(payload.requestId, {
          res,
          timer,
          toolInput: payload.toolInput,
        })

        // Parse questions from tool_input and forward to the webview
        const rawQuestions = Array.isArray(payload.toolInput.questions)
          ? (payload.toolInput.questions as Record<string, unknown>[]).map((q) => ({
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
          : []

        panel.webview.postMessage({
          command: 'askUserQuestion',
          hookQuestion: {
            requestId: payload.requestId,
            questions: rawQuestions,
            toolInput: payload.toolInput,
          },
        })
        return
      }

      // Check stored preferences first
      const prefs =
        vscode.workspace
          .getConfiguration('clay')
          .get<Record<string, 'always_allow' | 'always_deny'>>('toolPermissions') ?? {}

      // For Bash, check granular "Bash:<cmd>" key before the broad "Bash" key
      let saved = prefs[payload.toolName]
      if (payload.toolName === 'Bash' && !saved) {
        const cmd = getBaseCommand(String(payload.toolInput.command ?? ''))
        if (cmd) saved = prefs[`Bash:${cmd}`]
      }

      if (saved === 'always_allow') {
        hookAllow(res)
        return
      }
      if (saved === 'always_deny') {
        hookDeny(res)
        return
      }

      // Route to the correct panel
      const panel = openPanels.get(payload.sessionId)
      if (!panel) {
        hookDeny(res, 'No active panel')
        return
      }

      // Hold the response open until the user decides (max 1 hour)
      const timer = setTimeout(() => {
        pendingPermissions.delete(payload.requestId)
        try {
          hookDeny(res, 'Timed out')
        } catch {
          // socket may already be gone
        }
      }, 3_600_000)

      pendingPermissions.set(payload.requestId, { res, timer })

      panel.webview.postMessage({
        command: 'permissionRequest',
        request: payload,
      })
    } catch {
      res.writeHead(400)
      res.end()
    }
  })
}

// ── Server ───────────────────────────────────────────────────────────

export function startPermissionServer(): void {
  permissionServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/hook/pre-tool-use') {
      res.writeHead(404)
      res.end()
      return
    }

    handlePreToolUse(req, res)
  })

  permissionServer.listen(0, '127.0.0.1', () => {
    const addr = permissionServer!.address()
    permissionPort = typeof addr === 'object' && addr !== null ? addr.port : 0
  })
}

export function stopPermissionServer(): void {
  for (const [, pending] of pendingPermissions) {
    clearTimeout(pending.timer)
    try {
      hookDeny(pending.res, 'Extension deactivating')
    } catch {
      // socket may already be gone
    }
  }
  pendingPermissions.clear()

  for (const [, pending] of pendingHookQuestions) {
    clearTimeout(pending.timer)
    try {
      hookDeny(pending.res, 'Extension deactivating')
    } catch {
      // socket may already be gone
    }
  }
  pendingHookQuestions.clear()

  permissionServer?.close()
}
