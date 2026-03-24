import { useState, useEffect } from 'react'
import { Conversation } from './components/chat/Conversation'
import type { Turn, SessionMeta, Attachment } from './lib/types'
import { vscodeApi } from './lib/vscode'

interface SessionPayload extends SessionMeta {
  turns: Turn[]
  isActive: boolean
}

export function App(): React.JSX.Element {
  const [turns, setTurns] = useState<Turn[]>([])
  const [meta, setMeta] = useState<SessionMeta | null>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const handler = (event: MessageEvent<{ command: string; session?: SessionPayload }>): void => {
      const msg = event.data
      if ((msg.command === 'loadSession' || msg.command === 'updateSession') && msg.session) {
        const { turns: newTurns, isActive: active, ...newMeta } = msg.session
        setTurns(newTurns)
        setMeta(newMeta)
        setIsActive(active)
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {meta ? (
        <Conversation
          turns={turns}
          meta={meta}
          isActive={isActive}
          onSendMessage={handleSendMessage}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a session from the sidebar to view it
        </div>
      )}
    </div>
  )
}
