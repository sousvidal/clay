import * as vscode from 'vscode'
import { getWebviewContent } from './webview-provider'
import { SessionsProvider } from './sessions-provider'

let chatPanel: vscode.WebviewPanel | undefined

export function activate(context: vscode.ExtensionContext): void {
  // Sessions sidebar
  const sessionsProvider = new SessionsProvider()
  const treeView = vscode.window.createTreeView('claySessions', {
    treeDataProvider: sessionsProvider,
    showCollapseAll: false,
  })

  // Open chat panel
  const openChat = vscode.commands.registerCommand('clay.openChat', () => {
    if (chatPanel) {
      chatPanel.reveal(vscode.ViewColumn.One)
      return
    }

    chatPanel = vscode.window.createWebviewPanel('clayChat', 'Clay', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
    })

    chatPanel.webview.html = getWebviewContent(chatPanel.webview, context.extensionUri)

    chatPanel.webview.onDidReceiveMessage(
      (message: { command: string }) => {
        switch (message.command) {
          case 'getTheme':
            chatPanel?.webview.postMessage({
              command: 'theme',
              kind: vscode.window.activeColorTheme.kind,
            })
            break
        }
      },
      undefined,
      context.subscriptions,
    )

    chatPanel.onDidDispose(
      () => {
        chatPanel = undefined
      },
      undefined,
      context.subscriptions,
    )
  })

  // Open a specific session
  const openSession = vscode.commands.registerCommand('clay.openSession', (sessionId: string) => {
    vscode.commands.executeCommand('clay.openChat')
    // TODO: load session by ID into the chat panel
    chatPanel?.webview.postMessage({ command: 'loadSession', sessionId })
  })

  // New session
  const newSession = vscode.commands.registerCommand('clay.newSession', () => {
    vscode.commands.executeCommand('clay.openChat')
    chatPanel?.webview.postMessage({ command: 'newSession' })
  })

  // Refresh sessions
  const refreshSessions = vscode.commands.registerCommand('clay.refreshSessions', () => {
    sessionsProvider.refresh()
  })

  // Delete session
  const deleteSession = vscode.commands.registerCommand(
    'clay.deleteSession',
    (item: { session: { id: string; title: string } }) => {
      vscode.window
        .showWarningMessage(`Delete session "${item.session.title}"?`, { modal: true }, 'Delete')
        .then((choice) => {
          if (choice === 'Delete') {
            // TODO: actually delete the session
            sessionsProvider.refresh()
          }
        })
    },
  )

  context.subscriptions.push(
    treeView,
    openChat,
    openSession,
    newSession,
    refreshSessions,
    deleteSession,
  )

  // Auto-open chat on activation
  vscode.commands.executeCommand('clay.openChat')
}

export function deactivate(): void {
  chatPanel?.dispose()
}
