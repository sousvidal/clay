import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { SessionsProvider } from './sessions-provider'
import { parseSessionFile } from './session-parser'
import type { ParsedSession } from './webview/lib/types'
import { startPermissionServer, stopPermissionServer } from './permission-server'
import {
  openPanels,
  activeProcesses,
  processReadyPromises,
  killProcess,
  spawnClaudeProcess,
} from './process-manager'
import { getJsonlPath, createChatPanel, sendSession, setupSessionWatcher } from './panel-helpers'
import { wirePanelMessages } from './panel-messages'
import type { SessionState } from './panel-messages'

export function activate(context: vscode.ExtensionContext): void {
  startPermissionServer()

  const sessionsProvider = new SessionsProvider()
  const treeView = vscode.window.createTreeView('claySessions', {
    treeDataProvider: sessionsProvider,
    showCollapseAll: false,
  })

  // Per-panel cleanup functions (fs.watch closers)
  const panelCleanups = new Map<string, () => void>()

  function cleanupPanel(sessionId: string): void {
    panelCleanups.get(sessionId)?.()
    panelCleanups.delete(sessionId)
    killProcess(sessionId)
  }

  // ── clay.openSession ───────────────────────────────────────────────
  const openSession = vscode.commands.registerCommand(
    'clay.openSession',
    async (sessionId: string) => {
      const session = sessionsProvider.getSession(sessionId)
      if (!session) {
        vscode.window.showErrorMessage(`Session not found: ${sessionId}`)
        return
      }

      const panel = createChatPanel(sessionId, session.title, context)
      const workspacePath =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(session.jsonlPath)

      // Initial load
      let parsed: ParsedSession | null = null
      try {
        parsed = await parseSessionFile(session.jsonlPath)
      } catch {
        vscode.window.showErrorMessage(`Failed to load session: ${sessionId}`)
        return
      }

      const sessionState: SessionState = { id: sessionId, spawnMode: 'resume' }

      // Wire messages (handles 'ready' + 'sendMessage')
      const msgDisposable = wirePanelMessages(
        panel,
        sessionState,
        workspacePath,
        async () => (parsed ? parsed : parseSessionFile(session.jsonlPath)),
        panelCleanups,
      )

      // Send immediately (webview may already be mounted)
      sendSession(panel, parsed, session.isActive, 'loadSession')

      // Always watch — the session might still be active even if we couldn't
      // determine that from the sessions directory
      const cleanup = setupSessionWatcher(session.jsonlPath, panel, true)
      panelCleanups.set(sessionId, cleanup)

      panel.onDidDispose(() => {
        msgDisposable.dispose()
        cleanupPanel(sessionState.id)
      })
    },
  )

  // ── clay.newSession ────────────────────────────────────────────────
  const newSession = vscode.commands.registerCommand('clay.newSession', () => {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!workspacePath) {
      vscode.window.showErrorMessage('Clay: No workspace folder open. Please open a folder first.')
      return
    }

    const sessionId = crypto.randomUUID()
    const jsonlPath = getJsonlPath(workspacePath, sessionId)

    // Ensure project directory exists before spawning
    fs.mkdirSync(path.dirname(jsonlPath), { recursive: true })

    const panel = createChatPanel(sessionId, 'New session', context)

    // Empty session — shows the input bar immediately
    const emptySession: ParsedSession = {
      sessionId,
      model: null,
      gitBranch: null,
      cwd: workspacePath,
      version: null,
      turns: [],
    }

    const sessionState: SessionState = { id: sessionId, spawnMode: 'new' }

    // Wire messages (handles 'ready' + 'sendMessage')
    const msgDisposable = wirePanelMessages(
      panel,
      sessionState,
      workspacePath,
      async () => emptySession,
      panelCleanups,
    )

    // Send immediately
    sendSession(panel, emptySession, true, 'loadSession')

    // Watch for Claude's writes — refresh sidebar on first write (session now has content)
    const cleanup = setupSessionWatcher(jsonlPath, panel, true, () => {
      sessionsProvider.refresh()
    })
    panelCleanups.set(sessionId, cleanup)

    panel.onDidDispose(() => {
      msgDisposable.dispose()
      cleanupPanel(sessionState.id)
    })
  })

  // ── clay.newSessionWithMessage ────────────────────────────────────
  const newSessionWithMessage = vscode.commands.registerCommand(
    'clay.newSessionWithMessage',
    (message: string) => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!workspacePath) return

      const buildSessionId = crypto.randomUUID()
      const buildJsonlPath = getJsonlPath(workspacePath, buildSessionId)
      fs.mkdirSync(path.dirname(buildJsonlPath), { recursive: true })

      const buildPanel = createChatPanel(buildSessionId, 'Build from plan', context)
      const emptySession: ParsedSession = {
        sessionId: buildSessionId,
        model: null,
        gitBranch: null,
        cwd: workspacePath,
        version: null,
        turns: [],
      }
      const buildState: SessionState = { id: buildSessionId, spawnMode: 'new' }

      const buildMsgDisposable = wirePanelMessages(
        buildPanel,
        buildState,
        workspacePath,
        async () => emptySession,
        panelCleanups,
      )

      sendSession(buildPanel, emptySession, true, 'loadSession')

      const buildCleanup = setupSessionWatcher(buildJsonlPath, buildPanel, true, () => {
        sessionsProvider.refresh()
      })
      panelCleanups.set(buildSessionId, buildCleanup)

      buildPanel.onDidDispose(() => {
        buildMsgDisposable.dispose()
        cleanupPanel(buildState.id)
      })

      // Spawn and send the plan as the first message
      const proc = spawnClaudeProcess('new', buildSessionId, workspacePath)
      const readyPromise = processReadyPromises.get(buildSessionId)
      if (readyPromise) {
        readyPromise.then(() => {
          processReadyPromises.delete(buildSessionId)
          const payload = JSON.stringify({
            type: 'user',
            message: {
              role: 'user',
              content: [{ type: 'text', text: `Execute this plan:\n\n${message}` }],
            },
          })
          proc.stdin?.write(payload + '\n')
        })
      }
    },
  )

  // ── clay.openChat (alias for newSession) ──────────────────────────
  const openChat = vscode.commands.registerCommand('clay.openChat', () => {
    vscode.commands.executeCommand('clay.newSession')
  })

  // ── clay.refreshSessions ──────────────────────────────────────────
  const refreshSessions = vscode.commands.registerCommand('clay.refreshSessions', () => {
    sessionsProvider.refresh()
  })

  // ── clay.deleteSession ────────────────────────────────────────────
  const deleteSession = vscode.commands.registerCommand(
    'clay.deleteSession',
    (item: { session: { id: string; title: string } }) => {
      vscode.window
        .showWarningMessage(`Delete session "${item.session.title}"?`, { modal: true }, 'Delete')
        .then((choice) => {
          if (choice === 'Delete') {
            sessionsProvider.refresh()
          }
        })
    },
  )

  context.subscriptions.push(
    treeView,
    openSession,
    newSession,
    newSessionWithMessage,
    openChat,
    refreshSessions,
    deleteSession,
  )
}

export function deactivate(): void {
  stopPermissionServer()

  for (const panel of openPanels.values()) {
    panel.dispose()
  }
  openPanels.clear()

  for (const [sessionId] of activeProcesses) {
    killProcess(sessionId)
  }
}
