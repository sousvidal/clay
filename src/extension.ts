import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { spawn, execSync, type ChildProcess } from 'child_process'
import * as crypto from 'crypto'
import { getWebviewContent } from './webview-provider'
import { SessionsProvider, encodeProjectPath, getClaudeProjectsDir } from './sessions-provider'
import { parseSessionFile } from './session-parser'
import type { ParsedSession, SlashCommand } from './webview/lib/types'

const openPanels = new Map<string, vscode.WebviewPanel>()
const activeProcesses = new Map<string, ChildProcess>()

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the real path of the `claude` binary by following symlinks.
 * Returns null if the binary cannot be found.
 */
function resolveClaudeBinary(): string | null {
  try {
    // `which claude` equivalent: find claude on PATH
    const rawPath = execSync('which claude', { encoding: 'utf8' }).trim()
    if (!rawPath) return null
    // Follow symlinks to the actual binary
    return fs.realpathSync(rawPath)
  } catch {
    return null
  }
}

/**
 * Extract built-in skill definitions from the Claude binary.
 *
 * The binary is a Bun-compiled JS bundle that embeds skill objects of the form:
 *   {type:"local",name:"clear",description:"Clear conversation history..."}
 *
 * We use `strings` to extract printable strings from the binary, then grep for
 * the `name:"X",description:"Y"` pattern that appears in each skill definition.
 * Names that appear with more than one description are tool-input schema fields
 * (not skills) and are excluded.
 */
async function extractBuiltinCommands(binaryPath: string): Promise<SlashCommand[]> {
  return new Promise((resolve) => {
    let stdout = ''
    let timedOut = false

    // `strings` extracts printable character sequences from the binary
    const proc = spawn('strings', [binaryPath])
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve([])
    }, 10000)

    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    proc.on('error', () => {
      clearTimeout(timer)
      resolve([])
    })
    proc.on('close', () => {
      if (!timedOut) clearTimeout(timer)

      // Skill definitions in the binary look like:
      //   type:"local",name:"clear",description:"Clear conversation history..."
      //   type:"local-jsx",name:"mcp",description:"Manage MCP servers"
      // Matching on the type: prefix makes the extraction precise.
      const pattern = /type:"local(?:-jsx)?",name:"([a-z][a-z0-9_-]*)",description:"([^"]{3,120})"/g
      const seen = new Map<string, string>()
      let m: RegExpExecArray | null
      while ((m = pattern.exec(stdout)) !== null) {
        const [, name, desc] = m
        if (!seen.has(name)) seen.set(name, desc)
      }

      const commands: SlashCommand[] = []
      for (const [name, description] of seen) {
        commands.push({ name: `/${name}`, description })
      }
      resolve(commands)
    })
  })
}

async function fetchSlashCommands(cwd: string): Promise<SlashCommand[]> {
  const commands = new Map<string, SlashCommand>()

  // Source 1: built-in commands extracted from the Claude binary
  const binaryPath = resolveClaudeBinary()
  if (binaryPath) {
    const builtins = await extractBuiltinCommands(binaryPath)
    for (const cmd of builtins) {
      commands.set(cmd.name, cmd)
    }
  }

  // Source 2: custom commands from ~/.claude/commands/ and {cwd}/.claude/commands/
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const commandDirs = [
    path.join(home, '.claude', 'commands'),
    path.join(cwd, '.claude', 'commands'),
  ]
  for (const dir of commandDirs) {
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const name = `/${path.basename(file, '.md')}`
      let description = ''
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8')
        const headingMatch = /^#+\s+(.+)$/m.exec(content)
        if (headingMatch) {
          description = headingMatch[1].trim()
        } else {
          const firstLine = content.split('\n').find((l) => l.trim().length > 0) ?? ''
          description = firstLine.trim()
        }
      } catch {
        // unreadable — skip
      }
      // Custom commands override builtins with the same name
      commands.set(name, { name, description })
    }
  }

  return [...commands.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function getJsonlPath(workspacePath: string, sessionId: string): string {
  return path.join(getClaudeProjectsDir(), encodeProjectPath(workspacePath), `${sessionId}.jsonl`)
}

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

function spawnClaudeProcess(
  mode: 'new' | 'resume',
  sessionId: string,
  cwd: string,
  model?: string,
  effort?: string | null,
): ChildProcess {
  const modeArgs = mode === 'new' ? ['--session-id', sessionId] : ['--resume', sessionId]
  const modelArgs = model ? ['--model', model] : []
  const effortArgs = effort ? ['--effort', effort] : []

  const proc = spawn(
    'claude',
    [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      ...modeArgs,
      ...modelArgs,
      ...effortArgs,
    ],
    { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
  )

  activeProcesses.set(sessionId, proc)

  proc.on('exit', () => {
    activeProcesses.delete(sessionId)
  })

  return proc
}

function killProcess(sessionId: string): void {
  const proc = activeProcesses.get(sessionId)
  if (proc && proc.exitCode === null) proc.kill()
  activeProcesses.delete(sessionId)
}

function createChatPanel(
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

function sendSession(
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
function setupSessionWatcher(
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

/**
 * Wire up message handling for a panel: 'ready' and 'sendMessage'.
 * Returns a disposable.
 */
interface AttachmentPayload {
  name: string
  mediaType: string
  data: string
  isText: boolean
}

function wirePanelMessages(
  panel: vscode.WebviewPanel,
  sessionId: string,
  workspacePath: string,
  getInitialSession: () => Promise<ParsedSession | null>,
  panelCleanups: Map<string, () => void>,
  spawnMode: 'new' | 'resume' = 'resume',
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
    }) => {
      if (msg.command === 'ready') {
        const parsed = await getInitialSession()
        if (parsed) {
          const isActive = activeProcesses.has(sessionId)
          sendSession(panel, parsed, isActive, 'loadSession')
        }
        fetchSlashCommands(workspacePath).then((commands) => {
          panel.webview.postMessage({ command: 'slashCommands', commands })
        })
        return
      }

      if (msg.command === 'openFile') {
        const filePath = msg.filePath
        if (!filePath) return
        try {
          const uri = vscode.Uri.file(filePath)
          const doc = await vscode.workspace.openTextDocument(uri)
          const sel =
            msg.line !== undefined ? new vscode.Range(msg.line, 0, msg.line, 0) : undefined
          await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true,
            selection: sel,
          })
        } catch {
          // file not found or unreadable — ignore silently
        }
        return
      }

      if (msg.command === 'sendMessage') {
        const text = (msg.text ?? '').trim()
        const attachments = msg.attachments ?? []
        if (!text && attachments.length === 0) return

        // Ensure a process is running
        let proc = activeProcesses.get(sessionId)
        if (!proc || proc.exitCode !== null) {
          proc = spawnClaudeProcess(
            spawnMode,
            sessionId,
            workspacePath,
            msg.model,
            msg.effort ?? undefined,
          )

          // Set up file watcher if not already watching
          if (!panelCleanups.has(sessionId)) {
            const jsonlPath = getJsonlPath(workspacePath, sessionId)
            const cleanup = setupSessionWatcher(jsonlPath, panel, true)
            panelCleanups.set(sessionId, cleanup)
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

        const payload = JSON.stringify({
          type: 'user',
          message: { role: 'user', content },
        })
        proc.stdin?.write(payload + '\n')
      }
    },
  )
}

// ── Extension lifecycle ──────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
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

      // Wire messages (handles 'ready' + 'sendMessage')
      const msgDisposable = wirePanelMessages(
        panel,
        sessionId,
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
        cleanupPanel(sessionId)
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

    // Wire messages (handles 'ready' + 'sendMessage')
    const msgDisposable = wirePanelMessages(
      panel,
      sessionId,
      workspacePath,
      async () => emptySession,
      panelCleanups,
      'new',
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
      cleanupPanel(sessionId)
    })
  })

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
    openChat,
    refreshSessions,
    deleteSession,
  )
}

export function deactivate(): void {
  for (const panel of openPanels.values()) {
    panel.dispose()
  }
  openPanels.clear()

  for (const [sessionId] of activeProcesses) {
    killProcess(sessionId)
  }
}
