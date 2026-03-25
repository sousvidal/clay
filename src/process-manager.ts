import * as vscode from 'vscode'
import { spawn, type ChildProcess } from 'child_process'
import { getPermissionPort } from './permission-server'

// ── Shared state ─────────────────────────────────────────────────────

export const openPanels = new Map<string, vscode.WebviewPanel>()
export const activeProcesses = new Map<string, ChildProcess>()
export const processReadyPromises = new Map<string, Promise<void>>()

// ── Constants ────────────────────────────────────────────────────────

export const PLAN_SYSTEM_PROMPT =
  'Always wrap your plan in <plan></plan> tags. Format the plan as clear markdown with a descriptive title, numbered steps, and file paths. When updating the plan, always output the complete updated plan in <plan> tags.'

// ── Process lifecycle ────────────────────────────────────────────────

export function spawnClaudeProcess(
  mode: 'new' | 'resume',
  sessionId: string,
  cwd: string,
  model?: string,
  effort?: string | null,
  planMode?: boolean,
): ChildProcess {
  const modeArgs = mode === 'new' ? ['--session-id', sessionId] : ['--resume', sessionId]
  const modelArgs = model ? ['--model', model] : []
  const effortArgs = effort ? ['--effort', effort] : []
  const planArgs = planMode
    ? ['--permission-mode', 'plan', '--append-system-prompt', PLAN_SYSTEM_PROMPT]
    : []

  const hookSettings = JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: '.*',
          hooks: [
            {
              type: 'http',
              url: `http://127.0.0.1:${getPermissionPort()}/hook/pre-tool-use`,
              timeout: 3600,
            },
          ],
        },
      ],
    },
  })

  const proc = spawn(
    'claude',
    [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--settings',
      hookSettings,
      ...modeArgs,
      ...modelArgs,
      ...effortArgs,
      ...planArgs,
    ],
    { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
  )

  activeProcesses.set(sessionId, proc)

  // Drain stdout/stderr so the OS pipe buffers never fill up and block the CLI.
  // Also detect readiness: the CLI emits a system init message on stdout once
  // initialization is complete — we gate the first stdin write on this signal.
  proc.stdout?.on('data', () => {})
  proc.stderr?.on('data', () => {})

  const ready = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 5_000)
    const done = (): void => {
      clearTimeout(timer)
      resolve()
    }
    proc.stdout?.once('data', done)
    proc.stderr?.once('data', done)
  })
  processReadyPromises.set(sessionId, ready)

  proc.on('exit', () => {
    activeProcesses.delete(sessionId)
    processReadyPromises.delete(sessionId)
  })

  return proc
}

export function killProcess(sessionId: string): void {
  const proc = activeProcesses.get(sessionId)
  if (proc && proc.exitCode === null) proc.kill()
  activeProcesses.delete(sessionId)
  processReadyPromises.delete(sessionId)
}
