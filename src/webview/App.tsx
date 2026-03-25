import { useState, useEffect, useCallback, useMemo } from 'react'
import { Conversation } from './components/chat/Conversation'
import type {
  Turn,
  SessionMeta,
  Attachment,
  SlashCommand,
  WorkspaceFile,
  PermissionRequest,
  PendingHookQuestion,
  ContentBlock,
  SavedPlan,
} from './lib/types'
import { vscodeApi } from './lib/vscode'

interface SessionPayload extends SessionMeta {
  turns: Turn[]
  isActive: boolean
}

const PLAN_TAG_RE = /<plan>([\s\S]*?)<\/plan>/

function extractPlanFromTurns(turns: Turn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]
    const textBlocks = turn.contentBlocks.filter(
      (b): b is { kind: 'text'; text: string } => b.kind === 'text',
    )
    if (textBlocks.length === 0) continue
    const combined = textBlocks.map((b) => b.text).join('\n\n')
    const match = PLAN_TAG_RE.exec(combined)
    if (match) return match[1].trim()
    if (combined.trim()) return combined
  }
  return null
}

export function App(): React.JSX.Element {
  const [turns, setTurns] = useState<Turn[]>([])
  const [meta, setMeta] = useState<SessionMeta | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([])
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([])
  const [pendingHookQuestion, setPendingHookQuestion] = useState<PendingHookQuestion | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Plan mode state (owned here because IPC messages arrive at App level)
  const [planMode, setPlanMode] = useState(false)
  const [planContent, setPlanContent] = useState<string | null>(null)
  const [planReadOnly, setPlanReadOnly] = useState(false)
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])

  useEffect(() => {
    const handler = (
      event: MessageEvent<{
        command: string
        session?: SessionPayload
        commands?: SlashCommand[]
        files?: WorkspaceFile[]
        request?: PermissionRequest
        hookQuestion?: PendingHookQuestion
        block?: ContentBlock
        content?: string
        readOnly?: boolean
        plans?: SavedPlan[]
      }>,
    ): void => {
      const msg = event.data
      if ((msg.command === 'loadSession' || msg.command === 'updateSession') && msg.session) {
        const { turns: newTurns, isActive: active, ...newMeta } = msg.session
        setTurns(newTurns)
        setMeta(newMeta)
        setIsActive(active)
        setIsProcessing(false)
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
      if (msg.command === 'askUserQuestion' && msg.hookQuestion) {
        setPendingHookQuestion(msg.hookQuestion)
      }
      if (msg.command === 'loadPlan' && msg.content) {
        setPlanContent(msg.content)
        setPlanMode(true)
        setPlanReadOnly(msg.readOnly ?? false)
      }
      if (msg.command === 'loadPlansList' && msg.plans) {
        setSavedPlans(msg.plans)
      }
      if (msg.command === 'planCommitted' && msg.plans) {
        setSavedPlans(msg.plans)
      }
    }

    window.addEventListener('message', handler)
    vscodeApi.postMessage({ command: 'ready' })
    return () => window.removeEventListener('message', handler)
  }, [])

  // Derive plan content from turns when in active (non-read-only) plan mode
  const extractedPlan = useMemo(() => {
    if (!planMode || planReadOnly) return null
    return extractPlanFromTurns(turns)
  }, [turns, planMode, planReadOnly])

  const activePlanContent = planReadOnly ? planContent : (extractedPlan ?? planContent)

  // Auto-persist plan content to disk
  useEffect(() => {
    if (activePlanContent && planMode && !planReadOnly) {
      vscodeApi.postMessage({ command: 'persistPlan', content: activePlanContent })
    }
  }, [activePlanContent, planMode, planReadOnly])

  function handleSendMessage(
    text: string,
    attachments: Attachment[],
    model: string,
    effort: string | null,
    planModeFlag: boolean,
  ): void {
    setIsProcessing(true)
    vscodeApi.postMessage({
      command: 'sendMessage',
      text,
      attachments,
      model,
      effort,
      planMode: planModeFlag,
    })
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

  function handleHookQuestionAnswer(answers: Record<string, string>): void {
    if (!pendingHookQuestion) return
    const { requestId } = pendingHookQuestion
    setPendingHookQuestion(null)
    vscodeApi.postMessage({ command: 'answerUserQuestion', requestId, answers })
  }

  function handleDismissHookQuestion(): void {
    if (!pendingHookQuestion) return
    const { requestId } = pendingHookQuestion
    setPendingHookQuestion(null)
    vscodeApi.postMessage({ command: 'dismissHookQuestion', requestId })
  }

  function handleStopSession(): void {
    setIsProcessing(false)
    vscodeApi.postMessage({ command: 'stopSession' })
  }

  const handleTogglePlanMode = useCallback((enabled: boolean) => {
    setPlanMode(enabled)
    if (!enabled) {
      setPlanContent(null)
      setPlanReadOnly(false)
    }
    vscodeApi.postMessage({ command: 'togglePlanMode', enabled })
  }, [])

  const handleBuildPlan = useCallback((content: string) => {
    vscodeApi.postMessage({ command: 'buildPlan', content })
  }, [])

  const handleSavePlan = useCallback((content: string) => {
    vscodeApi.postMessage({ command: 'commitPlan', content })
  }, [])

  const handleDiscardPlan = useCallback(() => {
    setPlanMode(false)
    setPlanContent(null)
    setPlanReadOnly(false)
    vscodeApi.postMessage({ command: 'discardPlan' })
  }, [])

  const handleClosePlanSheet = useCallback(() => {
    setPlanContent(null)
    setPlanReadOnly(false)
  }, [])

  const handleEditSavedPlan = useCallback(() => {
    setPlanReadOnly(false)
    setPlanMode(true)
    vscodeApi.postMessage({ command: 'togglePlanMode', enabled: true })
  }, [])

  const handleLoadSavedPlan = useCallback((planId: string) => {
    vscodeApi.postMessage({ command: 'loadSavedPlan', planId })
  }, [])

  const handleNewPlan = useCallback(() => {
    setPlanContent(null)
    setPlanReadOnly(false)
    setPlanMode(true)
    vscodeApi.postMessage({ command: 'togglePlanMode', enabled: true })
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {meta ? (
        <Conversation
          turns={turns}
          meta={meta}
          isActive={isActive}
          isProcessing={isProcessing}
          onSendMessage={handleSendMessage}
          onStopSession={handleStopSession}
          slashCommands={slashCommands}
          workspaceFiles={workspaceFiles}
          pendingPermission={pendingPermissions[0] ?? null}
          onPermissionResponse={handlePermissionResponse}
          pendingHookQuestion={pendingHookQuestion}
          onHookQuestionAnswer={handleHookQuestionAnswer}
          onDismissHookQuestion={handleDismissHookQuestion}
          planMode={planMode}
          planContent={activePlanContent}
          planReadOnly={planReadOnly}
          savedPlans={savedPlans}
          onTogglePlanMode={handleTogglePlanMode}
          onBuildPlan={handleBuildPlan}
          onSavePlan={handleSavePlan}
          onDiscardPlan={handleDiscardPlan}
          onClosePlanSheet={handleClosePlanSheet}
          onEditSavedPlan={handleEditSavedPlan}
          onLoadSavedPlan={handleLoadSavedPlan}
          onNewPlan={handleNewPlan}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a session from the sidebar to view it
        </div>
      )}
    </div>
  )
}
