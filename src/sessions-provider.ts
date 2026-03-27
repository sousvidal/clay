import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as readline from 'readline'
import { stripMetadataTags } from './parser/message-helpers'

interface Session {
  id: string
  title: string
  preview: string
  timestamp: Date
  model: string | null
  isActive: boolean
  jsonlPath: string
}

/**
 * Encode a workspace folder path the same way Claude Code does:
 * /Users/jane/my_project → -Users-jane-my_project
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/[/_]/g, '-')
}

/**
 * Get the Claude projects directory.
 */
export function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

/**
 * Check if a session is currently active by scanning ~/.claude/sessions/
 */
function getActiveSessionIds(): Set<string> {
  const sessionsDir = path.join(os.homedir(), '.claude', 'sessions')
  const activeIds = new Set<string>()

  try {
    const files = fs.readdirSync(sessionsDir)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8')
        const data = JSON.parse(content) as { sessionId?: string }
        if (data.sessionId) activeIds.add(data.sessionId)
      } catch {
        // skip corrupt files
      }
    }
  } catch {
    // sessions dir may not exist
  }

  return activeIds
}

/**
 * Extract session metadata by reading the first ~50 lines of a JSONL file.
 * Gets: first user message (title), timestamp, model.
 */
async function extractSessionMeta(
  jsonlPath: string,
): Promise<{ title: string; preview: string; timestamp: Date; model: string | null }> {
  let title = 'Untitled session'
  let preview = ''
  let timestamp = new Date(0)
  let model: string | null = null
  let linesRead = 0

  const stream = fs.createReadStream(jsonlPath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  try {
    for await (const line of rl) {
      if (linesRead++ > 80) break
      if (!line.trim()) continue

      try {
        const msg = JSON.parse(line) as Record<string, unknown>

        // Get timestamp from first message
        if (timestamp.getTime() === 0 && msg.timestamp) {
          timestamp = new Date(msg.timestamp as string)
        }

        // Get title from first user message
        if (msg.type === 'user' && title === 'Untitled session') {
          const message = msg.message as { content?: unknown } | undefined
          if (message?.content) {
            const content = message.content
            let raw = ''
            if (typeof content === 'string') {
              raw = content
            } else if (Array.isArray(content)) {
              const textBlock = (content as Array<{ type: string; text?: string }>).find(
                (b) => b.type === 'text',
              )
              if (textBlock?.text) raw = textBlock.text
            }
            const cleaned = stripMetadataTags(raw)
            if (cleaned.length > 0) {
              title = cleaned.slice(0, 120)
              preview = cleaned.slice(0, 200)
            }
          }
        }

        // Get model from first assistant message
        if (msg.type === 'assistant' && !model) {
          const message = msg.message as { model?: string } | undefined
          if (message?.model) {
            model = message.model
          }
        }

        // Once we have all we need, stop
        if (title !== 'Untitled session' && model) break
      } catch {
        // skip malformed lines
      }
    }
  } finally {
    rl.close()
    stream.destroy()
  }

  // Clean up title — remove newlines, trim
  title = title.replace(/\n/g, ' ').trim()
  if (title.length > 80) title = title.slice(0, 77) + '...'

  preview = preview.replace(/\n/g, ' ').trim()
  if (preview.length > 120) preview = preview.slice(0, 117) + '...'

  return { title, preview, timestamp, model }
}

/**
 * Discover all sessions for the current workspace folder.
 */
async function discoverSessions(workspacePath: string): Promise<Session[]> {
  const projectsDir = getClaudeProjectsDir()
  const encoded = encodeProjectPath(workspacePath)
  const projectDir = path.join(projectsDir, encoded)

  if (!fs.existsSync(projectDir)) return []

  const activeIds = getActiveSessionIds()
  const entries = fs.readdirSync(projectDir)
  const jsonlFiles = entries.filter((f) => f.endsWith('.jsonl'))

  const sessions: Session[] = []

  await Promise.all(
    jsonlFiles.map(async (file) => {
      const sessionId = file.replace('.jsonl', '')
      const jsonlPath = path.join(projectDir, file)

      try {
        const stat = fs.statSync(jsonlPath)
        // Skip empty files (likely still being created)
        if (stat.size < 2) return

        const meta = await extractSessionMeta(jsonlPath)

        sessions.push({
          id: sessionId,
          title: meta.title,
          preview: meta.preview,
          timestamp: meta.timestamp.getTime() > 0 ? meta.timestamp : stat.mtime,
          model: meta.model,
          isActive: activeIds.has(sessionId),
          jsonlPath,
        })
      } catch {
        // skip unreadable files
      }
    }),
  )

  // Sort by timestamp descending (most recent first)
  sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return sessions
}

/**
 * Format a relative time string.
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

class SessionItem extends vscode.TreeItem {
  constructor(public readonly session: Session) {
    super(session.title, vscode.TreeItemCollapsibleState.None)

    this.description = formatRelativeTime(session.timestamp)
    this.tooltip = new vscode.MarkdownString(
      [
        `**${session.title}**`,
        session.preview ? `\n\n${session.preview}` : '',
        session.model ? `\n\n_Model: ${session.model}_` : '',
        `\n\n_${session.timestamp.toLocaleString()}_`,
      ].join(''),
    )
    this.contextValue = session.isActive ? 'activeSession' : 'session'
    this.iconPath = new vscode.ThemeIcon(
      session.isActive ? 'comment-discussion' : 'comment',
      session.isActive ? new vscode.ThemeColor('charts.blue') : undefined,
    )

    this.command = {
      command: 'clay.openSession',
      title: 'Open Session',
      arguments: [session.id],
    }
  }
}

export class SessionsProvider implements vscode.TreeDataProvider<SessionItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionItem | undefined | null | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private sessions: Session[] = []
  private workspacePath: string | undefined

  constructor() {
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    // Re-discover when workspace changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      this.refresh()
    })
  }

  getTreeItem(element: SessionItem): vscode.TreeItem {
    return element
  }

  async getChildren(): Promise<SessionItem[]> {
    if (!this.workspacePath) return []

    this.sessions = await discoverSessions(this.workspacePath)
    return this.sessions.map((s) => new SessionItem(s))
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.find((s) => s.id === sessionId)
  }

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }
}
