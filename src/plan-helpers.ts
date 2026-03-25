import * as fs from 'fs'
import * as path from 'path'
import { encodeProjectPath, getClaudeProjectsDir } from './sessions-provider'

// ── Types ────────────────────────────────────────────────────────────

export interface SavedPlanEntry {
  id: string
  title: string
  content: string
  createdAt: string
}

// ── Path helpers ─────────────────────────────────────────────────────

export function getPlanActivePath(workspacePath: string, sessionId: string): string {
  return path.join(
    getClaudeProjectsDir(),
    encodeProjectPath(workspacePath),
    `plan-${sessionId}-active.md`,
  )
}

export function getPlansIndexPath(workspacePath: string, sessionId: string): string {
  return path.join(
    getClaudeProjectsDir(),
    encodeProjectPath(workspacePath),
    `plans-${sessionId}.json`,
  )
}

// ── Index read/write ─────────────────────────────────────────────────

export function readPlansIndex(indexPath: string): SavedPlanEntry[] {
  try {
    if (!fs.existsSync(indexPath)) return []
    return JSON.parse(fs.readFileSync(indexPath, 'utf8')) as SavedPlanEntry[]
  } catch {
    return []
  }
}

export function writePlansIndex(indexPath: string, plans: SavedPlanEntry[]): void {
  fs.writeFileSync(indexPath, JSON.stringify(plans, null, 2))
}

export function extractPlanTitle(content: string): string {
  const headingMatch = /^#+\s+(.+)$/m.exec(content)
  if (headingMatch) return headingMatch[1].trim()
  const firstLine = content.split('\n').find((l) => l.trim().length > 0)
  if (firstLine) return firstLine.trim().slice(0, 60)
  return 'Untitled plan'
}
