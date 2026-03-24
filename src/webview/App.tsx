import { useState, useEffect } from 'react'
import { Conversation } from './components/chat/Conversation'
import type {
  Turn,
  SessionMeta,
  Attachment,
  SlashCommand,
  WorkspaceFile,
  PermissionRequest,
  ContentBlock,
} from './lib/types'
import { vscodeApi } from './lib/vscode'

interface SessionPayload extends SessionMeta {
  turns: Turn[]
  isActive: boolean
}

export function App(): React.JSX.Element {
  const [turns, setTurns] = useState<Turn[]>([])
  const [meta, setMeta] = useState<SessionMeta | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([])
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([])

  useEffect(() => {
    const handler = (
      event: MessageEvent<{
        command: string
        session?: SessionPayload
        commands?: SlashCommand[]
        files?: WorkspaceFile[]
        request?: PermissionRequest
        block?: ContentBlock
      }>,
    ): void => {
      const msg = event.data
      if ((msg.command === 'loadSession' || msg.command === 'updateSession') && msg.session) {
        const { turns: newTurns, isActive: active, ...newMeta } = msg.session
        setTurns(newTurns)
        setMeta(newMeta)
        setIsActive(active)
      }
      if (msg.command === 'systemMessage' && msg.block) {
        const syntheticTurn: Turn = {
          id: `system-${Date.now()}`,
          userMessage: null,
          userAttachments: [],
          contentBlocks: [msg.block],
          timestamp: new Date().toISOString(),
          durationMs: null,
          model: null,
          tokenUsage: null,
        }
        setTurns((prev) => [...prev, syntheticTurn])
      }
      if (msg.command === 'slashCommands' && msg.commands) {
        setSlashCommands(msg.commands)
      }
      if (msg.command === 'workspaceFiles' && msg.files) {
        setWorkspaceFiles(msg.files)
      }
      if (msg.command === 'permissionRequest' && msg.request) {
        setPendingPermissions((prev) => [...prev, msg.request!])
      }
    }

    window.addEventListener('message', handler)

    // Tell extension we're ready
    vscodeApi.postMessage({ command: 'ready' })

    return () => window.removeEventListener('message', handler)
  }, [])

  function handleSendMessage(
    text: string,
    attachments: Attachment[],
    model: string,
    effort: string | null,
  ): void {
    vscodeApi.postMessage({ command: 'sendMessage', text, attachments, model, effort })
  }

  function handlePermissionResponse(
    requestId: string,
    allow: boolean,
    remember: boolean,
    toolName: string,
  ): void {
    setPendingPermissions((prev) => prev.filter((r) => r.requestId !== requestId))
    vscodeApi.postMessage({ command: 'permissionResponse', requestId, allow, remember, toolName })
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {meta ? (
        <Conversation
          turns={turns}
          meta={meta}
          isActive={isActive}
          onSendMessage={handleSendMessage}
          slashCommands={slashCommands}
          workspaceFiles={workspaceFiles}
          pendingPermission={pendingPermissions[0] ?? null}
          onPermissionResponse={handlePermissionResponse}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a session from the sidebar to view it
        </div>
      )}
    </div>
  )
}
