import { FileText, FileEdit, Search, FilePlus, Terminal, Globe, Layers } from 'lucide-react'
import type { ToolCall } from '../../../lib/types'

export function getToolIcon(name: string): React.ReactNode {
  switch (name) {
    case 'Read':
      return <FileText className="size-3" />
    case 'Edit':
      return <FileEdit className="size-3" />
    case 'Write':
      return <FilePlus className="size-3" />
    case 'Grep':
    case 'Glob':
      return <Search className="size-3" />
    case 'Bash':
      return <Terminal className="size-3" />
    case 'WebFetch':
    case 'WebSearch':
      return <Globe className="size-3" />
    case 'Agent':
    case 'Task':
      return <Layers className="size-3" />
    default:
      return <FileText className="size-3" />
  }
}

export function getFileContext(toolCall: ToolCall): { path: string; line?: number } | null {
  const inp = toolCall.input
  switch (toolCall.name) {
    case 'Read':
      return { path: inp.file_path as string, line: inp.offset as number | undefined }
    case 'Write':
    case 'Edit':
      return { path: inp.file_path as string }
    default:
      return null
  }
}

export function getToolSummary(toolCall: ToolCall): string {
  const inp = toolCall.input
  switch (toolCall.name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(inp.file_path ?? '')
    case 'Grep':
      return `${inp.pattern ?? ''} ${inp.path ? `in ${inp.path}` : ''}`
    case 'Glob':
      return String(inp.pattern ?? '')
    case 'Bash':
      return String(inp.command ?? '')
    case 'WebFetch':
      return String(inp.url ?? '')
    case 'WebSearch':
      return String(inp.query ?? '')
    default:
      return ''
  }
}
