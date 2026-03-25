import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { getWebviewContent } from './webview-provider'
import { encodeProjectPath, getClaudeProjectsDir } from './sessions-provider'
import { parseSessionFile } from './session-parser'
import type { ParsedSession } from './webview/lib/types'
import { openPanels } from './process-manager'

// ── JSONL path ───────────────────────────────────────────────────────

export function getJsonlPath(workspacePath: string, sessionId: string): string {
  return path.join(getClaudeProjectsDir(), encodeProjectPath(workspacePath), `${sessionId}.jsonl`)
}

// ── JSONL watcher ────────────────────────────────────────────────────

/**
 * Watch a JSONL file for changes using Node.js fs.watch on its parent directory.
 * More reliable than vscode.workspace.createFileSystemWatcher for paths outside
 * the workspace (e.g. ~/.claude/projects/).
 *
 * Handles both file creation (new sessions) and changes (ongoing sessions).
 * Debounced at 150 ms to avoid hammering the parser on rapid writes.
 *
 * Returns a cleanup function.
 */
function watchJsonl(jsonlPath: string, onChange: () => void): () => void {
  const dir = path.dirname(jsonlPath)
  const filename = path.basename(jsonlPath)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // Ensure the directory exists before we try to watch it
  fs.mkdirSync(dir, { recursive: true })

  let watcher: fs.FSWatcher | null = null
  try {
    watcher = fs.watch(dir, (_, watchedFile) => {
      if (watchedFile !== filename) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(onChange, 150)
    })
  } catch {
    // directory watch not supported — fall back silently
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    watcher?.close()
  }
}

// ── Panel creation ───────────────────────────────────────────────────

export function createChatPanel(
  sessionId: string,
  title: string,
  context: vscode.ExtensionContext,
): vscode.WebviewPanel {
  const existing = openPanels.get(sessionId)
  if (existing) {
    existing.reveal(vscode.ViewColumn.One)
    return existing
  }

  const panel = vscode.window.createWebviewPanel('clayChat', title, vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
  })

  panel.webview.html = getWebviewContent(panel.webview, context.extensionUri)

  panel.onDidDispose(() => {
    openPanels.delete(sessionId)
  })

  openPanels.set(sessionId, panel)
  return panel
}

// ── Session sending ──────────────────────────────────────────────────

export function sendSession(
  panel: vscode.WebviewPanel,
  parsed: ParsedSession,
  isActive: boolean,
  command: 'loadSession' | 'updateSession',
): void {
  panel.webview.postMessage({
    command,
    session: {
      sessionId: parsed.sessionId,
      model: parsed.model,
      gitBranch: parsed.gitBranch,
      cwd: parsed.cwd,
      version: parsed.version,
      turns: parsed.turns,
      isActive,
    },
  })
}

/**
 * Set up a JSONL file watcher that sends updateSession to the webview on every change.
 * Returns a cleanup function.
 */
export function setupSessionWatcher(
  jsonlPath: string,
  panel: vscode.WebviewPanel,
  isActive: boolean,
  onFirstWrite?: () => void,
): () => void {
  let firstWrite = true

  return watchJsonl(jsonlPath, async () => {
    try {
      if (!fs.existsSync(jsonlPath)) return
      const stat = fs.statSync(jsonlPath)
      if (stat.size < 2) return
      const updated = await parseSessionFile(jsonlPath)
      sendSession(panel, updated, isActive, 'updateSession')
      if (firstWrite) {
        firstWrite = false
        onFirstWrite?.()
      }
    } catch {
      // ignore transient read errors (Claude may be mid-write)
    }
  })
}

// ── System messages ──────────────────────────────────────────────────

export function postSystemMessage(
  panel: vscode.WebviewPanel,
  text: string,
  level: 'info' | 'warning' = 'info',
): void {
  panel.webview.postMessage({
    command: 'systemMessage',
    block: { kind: 'system_message', text, level },
  })
}
