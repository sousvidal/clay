import { useState, useCallback } from 'react'
import {
  ChevronRight,
  File,
  FileCode,
  FileText,
  FileJson,
  Folder,
  FolderOpen,
  Image,
  FileType,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mockFileTree, type FileTreeNode, type GitStatus } from '@/lib/mock-file-tree'

const INDENT = 10
const BASE_PAD = 6

function getFileIcon(name: string): React.ReactNode {
  const ext = name.split('.').pop()
  const base = name.split('.')[0]

  if (name === '.env' || name === '.gitignore')
    return <File className="size-4 shrink-0 text-muted-foreground/50" />
  if (name.startsWith('vite.config') || name.startsWith('tsconfig'))
    return <FileText className="size-4 shrink-0 text-muted-foreground/60" />
  if (base.endsWith('.test') || base.endsWith('.spec'))
    return <FileCode className="size-4 shrink-0 text-muted-foreground/70" />
  if (name.endsWith('.d.ts'))
    return <FileType className="size-4 shrink-0 text-muted-foreground/60" />

  switch (ext) {
    case 'tsx':
    case 'ts':
      return <FileCode className="size-4 shrink-0 text-muted-foreground/80" />
    case 'jsx':
    case 'js':
      return <FileCode className="size-4 shrink-0 text-muted-foreground/70" />
    case 'css':
    case 'scss':
      return <FileText className="size-4 shrink-0 text-muted-foreground/70" />
    case 'json':
      return <FileJson className="size-4 shrink-0 text-muted-foreground/60" />
    case 'md':
      return <FileText className="size-4 shrink-0 text-muted-foreground/50" />
    case 'ico':
    case 'png':
    case 'svg':
      return <Image className="size-4 shrink-0 text-muted-foreground/60" />
    default:
      return <File className="size-4 shrink-0 text-muted-foreground/50" />
  }
}

function getGitStatusColor(status: GitStatus): string {
  switch (status) {
    case 'modified':
      return 'text-[#c4a54a] dark:text-[#cca700]'
    case 'untracked':
    case 'added':
      return 'text-[#3a8c3f] dark:text-[#73c991]'
    case 'deleted':
      return 'text-[#c74e39] dark:text-[#c74e39] line-through'
    case 'renamed':
      return 'text-[#569cd6] dark:text-[#73c991]'
    case 'conflict':
      return 'text-[#c74e39] dark:text-[#e51400]'
  }
}

function getGitBadgeColor(status: GitStatus): string {
  return getGitStatusColor(status)
}

function getGitStatusLabel(status: GitStatus): string {
  switch (status) {
    case 'modified':
      return 'M'
    case 'untracked':
      return 'U'
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'renamed':
      return 'R'
    case 'conflict':
      return 'C'
  }
}

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  selectedFile: string | null
  onSelect: (name: string) => void
}

function FileTreeItem({
  node,
  depth,
  selectedFile,
  onSelect,
}: FileTreeItemProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1)
  const isFolder = node.type === 'folder'
  const isSelected = !isFolder && selectedFile === node.name
  const handleClick = useCallback((): void => {
    if (isFolder) {
      setExpanded((prev) => !prev)
    } else {
      onSelect(node.name)
    }
  }, [isFolder, node.name, onSelect])

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'group/row flex w-full items-center gap-1 py-[3px] pr-2 text-left text-[13px] font-[450] leading-tight outline-none transition-colors',
          'hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e]',
          isSelected && 'bg-[#0060c0]/20 dark:bg-[#094771]/60',
          node.gitStatus && getGitStatusColor(node.gitStatus),
        )}
        style={{ paddingLeft: `${depth * INDENT + BASE_PAD}px` }}
      >
        {isFolder ? (
          <>
            <ChevronRight
              className={cn(
                'size-3 shrink-0 text-muted-foreground/60 transition-transform duration-100',
                expanded && 'rotate-90',
              )}
            />
            {expanded ? (
              <FolderOpen className="size-4 shrink-0 text-muted-foreground/70" />
            ) : (
              <Folder className="size-4 shrink-0 text-muted-foreground/70" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>

        {node.isOpen && !node.gitStatus && (
          <Circle className="size-1.5 shrink-0 fill-muted-foreground/40 text-muted-foreground/40" />
        )}

        {node.gitStatus && (
          <span
            className={cn(
              'shrink-0 text-[11px] font-medium leading-none',
              getGitBadgeColor(node.gitStatus),
            )}
          >
            {getGitStatusLabel(node.gitStatus)}
          </span>
        )}
      </button>

      {isFolder && expanded && node.children && (
        <div className="relative">
          <div
            className="absolute bottom-0 top-0 w-px bg-border/30"
            style={{ left: `${depth * INDENT + BASE_PAD + 7}px` }}
          />
          {node.children.map((child) => (
            <FileTreeItem
              key={child.name}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<string | null>('App.tsx')

  return (
    <div className="py-1">
      {mockFileTree.map((node) => (
        <FileTreeItem
          key={node.name}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
        />
      ))}
    </div>
  )
}
