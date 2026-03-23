import Editor from '@monaco-editor/react'

const MOCK_CODE = `import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface AppProps {
  initialRoute?: string
}

export function App({ initialRoute = '/' }: AppProps) {
  const { user, isLoading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = '/login'
    }
  }, [user, isLoading])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="flex-1 overflow-auto">
        <Header user={user} />
        <div className="p-6">
          {/* Route content will be rendered here */}
        </div>
      </main>
    </div>
  )
}
`

function useIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function MonacoTab(): React.JSX.Element {
  const isDark = useIsDark()

  return (
    <div className="h-full w-full">
      <Editor
        defaultLanguage="typescript"
        defaultValue={MOCK_CODE}
        path="App.tsx"
        theme={isDark ? 'vs-dark' : 'vs'}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          fontSize: 13,
          lineHeight: 20,
          fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
          fontLigatures: true,
          renderLineHighlight: 'gutter',
          scrollBeyondLastLine: false,
          padding: { top: 8 },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          guides: {
            indentation: true,
            bracketPairs: true,
          },
        }}
      />
    </div>
  )
}
