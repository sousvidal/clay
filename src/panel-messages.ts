import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { parseSessionFile } from './session-parser'
import {
  activeProcesses,
  processReadyPromises,
  killProcess,
  spawnClaudeProcess,
} from './process-manager'
import { pendingPermissions, pendingHookQuestions, hookAllow, hookDeny } from './permission-server'
import { fetchSlashCommands, listWorkspaceFiles, resolveCustomCommand } from './slash-commands'
import { getJsonlPath, sendSession, setupSessionWatcher, postSystemMessage } from './panel-helpers'

// ── Types ────────────────────────────────────────────────────────────

interface AttachmentPayload {
  name: string
  mediaType: string
  data: string
  isText: boolean
}

export interface SessionState {
  id: string
  spawnMode: 'new' | 'resume'
}

// ── Message handler ──────────────────────────────────────────────────

export function wirePanelMessages(
  panel: vscode.WebviewPanel,
  session: SessionState,
  workspacePath: string,
  getInitialSession: () => Promise<import('./webview/lib/types').ParsedSession | null>,
  panelCleanups: Map<string, () => void>,
): vscode.Disposable {
  return panel.webview.onDidReceiveMessage(
    async (msg: {
      command: string
      text?: string
      attachments?: AttachmentPayload[]
      model?: string
      effort?: string | null
      filePath?: string
      line?: number
      requestId?: string
      allow?: boolean
      remember?: boolean
      toolName?: string
      toolUseId?: string
      answer?: string
      answers?: Record<string, string>
    }) => {
      if (msg.command === 'permissionResponse') {
        handlePermissionResponse(msg)
        return
      }

      if (msg.command === 'answerUserQuestion') {
        handleAnswerUserQuestion(
          msg as { requestId?: string; answers?: Record<string, string> },
          session,
        )
        return
      }

      if (msg.command === 'dismissHookQuestion') {
        handleDismissHookQuestion(msg as { requestId?: string })
        return
      }

      if (msg.command === 'answerQuestion') {
        handleAnswerQuestion(msg, session)
        return
      }

      if (msg.command === 'ready') {
        await handleReady(panel, session, workspacePath, getInitialSession)
        return
      }

      if (msg.command === 'getWorkspaceFile') {
        handleGetWorkspaceFile(panel, msg.filePath)
        return
      }

      if (msg.command === 'openFile') {
        await handleOpenFile(msg.filePath, msg.line)
        return
      }

      if (msg.command === 'stopSession') {
        await handleStopSession(panel, session, workspacePath)
        return
      }

      if (msg.command === 'sendMessage') {
        await handleSendMessage(panel, session, workspacePath, msg, panelCleanups)
      }
    },
  )
}

// ── Individual handlers ──────────────────────────────────────────────

function handlePermissionResponse(msg: {
  requestId?: string
  allow?: boolean
  remember?: boolean
  toolName?: string
}): void {
  const { requestId, allow, remember, toolName } = msg
  if (!requestId) return

  const pending = pendingPermissions.get(requestId)
  if (pending) {
    clearTimeout(pending.timer)
    pendingPermissions.delete(requestId)
    try {
      if (allow) {
        hookAllow(pending.res)
      } else {
        hookDeny(pending.res)
      }
    } catch {
      // socket may already be gone
    }
  }

  if (remember && toolName) {
    const config = vscode.workspace.getConfiguration('clay')
    const current = config.get<Record<string, string>>('toolPermissions') ?? {}
    void config.update(
      'toolPermissions',
      { ...current, [toolName]: allow ? 'always_allow' : 'always_deny' },
      vscode.ConfigurationTarget.Global,
    )
  }
}

function handleAnswerUserQuestion(
  msg: { requestId?: string; answers?: Record<string, string> },
  session: SessionState,
): void {
  const { requestId, answers } = msg
  if (!requestId || !answers) return
  const pending = pendingHookQuestions.get(requestId)
  if (!pending) return

  clearTimeout(pending.timer)
  pendingHookQuestions.delete(requestId)

  // Deny the held PreToolUse hook (unblocks Claude) then deliver
  // the user's answers via stdin as a regular user message.
  try {
    hookDeny(pending.res, 'User answered via custom UI. Their response follows as a user message.')
  } catch {
    // socket may already be gone
  }

  const proc = activeProcesses.get(session.id)
  if (!proc || proc.exitCode !== null) return

  const answerEntries = Object.entries(answers)
  const content =
    answerEntries.length === 1
      ? answerEntries[0][1]
      : answerEntries.map(([q, a]) => `${q}: ${a}`).join('\n')

  const payload = JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: content }],
    },
  })
  proc.stdin?.write(payload + '\n')
}

function handleDismissHookQuestion(msg: { requestId?: string }): void {
  const { requestId } = msg
  if (!requestId) return
  const pending = pendingHookQuestions.get(requestId)
  if (!pending) return

  clearTimeout(pending.timer)
  pendingHookQuestions.delete(requestId)

  try {
    hookDeny(pending.res, 'User dismissed the question')
  } catch {
    // socket may already be gone
  }
}

function handleAnswerQuestion(
  msg: { toolUseId?: string; answer?: string },
  session: SessionState,
): void {
  const { toolUseId, answer } = msg
  if (!toolUseId || answer === undefined) return
  const proc = activeProcesses.get(session.id)
  if (!proc || proc.exitCode !== null) return
  const payload = JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: answer }],
    },
  })
  proc.stdin?.write(payload + '\n')
}

async function handleReady(
  panel: vscode.WebviewPanel,
  session: SessionState,
  workspacePath: string,
  getInitialSession: () => Promise<import('./webview/lib/types').ParsedSession | null>,
): Promise<void> {
  const parsed = await getInitialSession()
  if (parsed) {
    const isActive = activeProcesses.has(session.id)
    sendSession(panel, parsed, isActive, 'loadSession')
  }
  fetchSlashCommands(workspacePath).then((commands) => {
    panel.webview.postMessage({ command: 'slashCommands', commands })
  })
  listWorkspaceFiles(workspacePath).then((files) => {
    panel.webview.postMessage({ command: 'workspaceFiles', files })
  })
}

function handleGetWorkspaceFile(panel: vscode.WebviewPanel, filePath?: string): void {
  if (!filePath) return
  const name = path.basename(filePath)
  const ext = path.extname(name).slice(1).toLowerCase()
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp'])
  try {
    if (IMAGE_EXTS.has(ext)) {
      const data = fs.readFileSync(filePath).toString('base64')
      const mediaType =
        ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'png'
            ? 'image/png'
            : ext === 'gif'
              ? 'image/gif'
              : 'image/webp'
      panel.webview.postMessage({
        command: 'workspaceFileContent',
        name,
        mediaType,
        data,
        isText: false,
      })
    } else {
      const data = fs.readFileSync(filePath, 'utf8')
      panel.webview.postMessage({
        command: 'workspaceFileContent',
        name,
        mediaType: 'text/plain',
        data,
        isText: true,
      })
    }
  } catch {
    // unreadable or binary — ignore silently
  }
}

async function handleOpenFile(filePath?: string, line?: number): Promise<void> {
  if (!filePath) return
  try {
    const uri = vscode.Uri.file(filePath)
    const doc = await vscode.workspace.openTextDocument(uri)
    const sel = line !== undefined ? new vscode.Range(line, 0, line, 0) : undefined
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
      selection: sel,
    })
  } catch {
    // file not found or unreadable — ignore silently
  }
}

async function handleStopSession(
  panel: vscode.WebviewPanel,
  session: SessionState,
  workspacePath: string,
): Promise<void> {
  const proc = activeProcesses.get(session.id)
  if (proc && proc.exitCode === null) {
    killProcess(session.id)
    session.spawnMode = 'resume'
    const jsonlPath = getJsonlPath(workspacePath, session.id)
    try {
      if (fs.existsSync(jsonlPath)) {
        const parsed = await parseSessionFile(jsonlPath)
        sendSession(panel, parsed, false, 'updateSession')
      }
    } catch {
      // ignore
    }
  }
}

async function handleSendMessage(
  panel: vscode.WebviewPanel,
  session: SessionState,
  workspacePath: string,
  msg: {
    text?: string
    attachments?: AttachmentPayload[]
    model?: string
    effort?: string | null
  },
  panelCleanups: Map<string, () => void>,
): Promise<void> {
  let text = (msg.text ?? '').trim()
  const attachments = msg.attachments ?? []
  if (!text && attachments.length === 0) return

  // ── Slash command router ───────────────────────────────────────
  if (text.startsWith('/') && attachments.length === 0) {
    const spaceIdx = text.indexOf(' ')
    const commandName = (spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx)).toLowerCase()
    const commandArgs = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1).trim()

    switch (commandName) {
      case 'clear': {
        panel.dispose()
        void vscode.commands.executeCommand('clay.newSession')
        return
      }

      case 'compact': {
        killProcess(session.id)
        const proc = spawnClaudeProcess(
          'resume',
          session.id,
          workspacePath,
          msg.model,
          msg.effort ?? undefined,
        )
        session.spawnMode = 'resume'

        if (!panelCleanups.has(session.id)) {
          const jsonlPath = getJsonlPath(workspacePath, session.id)
          const cleanupWatcher = setupSessionWatcher(jsonlPath, panel, true)
          panelCleanups.set(session.id, cleanupWatcher)
        }

        if (commandArgs) {
          const compactReady = processReadyPromises.get(session.id)
          if (compactReady) {
            await compactReady
            processReadyPromises.delete(session.id)
          }
          const payload = JSON.stringify({
            type: 'user',
            message: { role: 'user', content: [{ type: 'text', text: commandArgs }] },
          })
          proc.stdin?.write(payload + '\n')
        }

        postSystemMessage(panel, 'Context reloaded.')
        return
      }

      default: {
        // Try custom commands from .claude/commands/
        const template = resolveCustomCommand(commandName, workspacePath)
        if (template) {
          text = template.replace(/\$ARGUMENTS/g, commandArgs)
          // Fall through to normal send logic below
          break
        }

        // Unsupported built-in command
        postSystemMessage(
          panel,
          `/${commandName} is only available in the interactive Claude Code terminal.`,
          'warning',
        )
        return
      }
    }
  }

  // ── Normal message send ────────────────────────────────────────
  let proc = activeProcesses.get(session.id)
  if (!proc || proc.exitCode !== null) {
    proc = spawnClaudeProcess(
      session.spawnMode,
      session.id,
      workspacePath,
      msg.model,
      msg.effort ?? undefined,
    )

    if (!panelCleanups.has(session.id)) {
      const jsonlPath = getJsonlPath(workspacePath, session.id)
      const cleanup = setupSessionWatcher(jsonlPath, panel, true)
      panelCleanups.set(session.id, cleanup)
    }
  }

  const content: unknown[] = []
  if (text) content.push({ type: 'text', text })
  for (const att of attachments) {
    if (att.mediaType.startsWith('image/')) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: att.mediaType, data: att.data },
      })
    } else if (att.isText) {
      content.push({
        type: 'document',
        source: { type: 'text', data: att.data },
        title: att.name,
      })
    } else {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: att.mediaType, data: att.data },
        title: att.name,
      })
    }
  }

  const readyPromise = processReadyPromises.get(session.id)
  if (readyPromise) {
    await readyPromise
    processReadyPromises.delete(session.id)
  }

  const payload = JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
  })
  proc.stdin?.write(payload + '\n')
}
