import { FileText, Folder } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SlashCommand, WorkspaceFile } from '../../lib/types'

interface SlashAutocompleteProps {
  commands: SlashCommand[]
  highlightedIndex: number
  onSelect: (name: string) => void
}

export function SlashAutocomplete({
  commands,
  highlightedIndex,
  onSelect,
}: SlashAutocompleteProps): React.JSX.Element | null {
  if (commands.length === 0) return null

  return (
    <div className="absolute bottom-full left-4 right-4 mb-1 max-h-64 overflow-y-auto rounded-md border border-border/50 bg-popover shadow-md">
      {commands.map((cmd, i) => (
        <button
          key={cmd.name}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(cmd.name)
          }}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors',
            i === highlightedIndex ? 'bg-accent' : 'hover:bg-accent/50',
          )}
        >
          <span className="w-36 shrink-0 font-mono text-foreground">{cmd.name}</span>
          <span className="truncate text-muted-foreground">{cmd.description}</span>
        </button>
      ))}
    </div>
  )
}

interface FileAutocompleteProps {
  files: WorkspaceFile[]
  highlightedIndex: number
  onSelect: (file: WorkspaceFile) => void
}

export function FileAutocomplete({
  files,
  highlightedIndex,
  onSelect,
}: FileAutocompleteProps): React.JSX.Element | null {
  if (files.length === 0) return null

  return (
    <div className="absolute bottom-full left-4 right-4 mb-1 max-h-64 overflow-y-auto rounded-md border border-border/50 bg-popover shadow-md">
      {files.map((file, i) => (
        <button
          key={file.path}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(file)
          }}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors',
            i === highlightedIndex ? 'bg-accent' : 'hover:bg-accent/50',
          )}
        >
          {file.isDirectory ? (
            <Folder className="size-3 shrink-0 text-muted-foreground/60" />
          ) : (
            <FileText className="size-3 shrink-0 text-muted-foreground/60" />
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-foreground">
            {file.relativePath}
          </span>
          {file.isDirectory && <span className="text-muted-foreground/40">›</span>}
        </button>
      ))}
    </div>
  )
}
