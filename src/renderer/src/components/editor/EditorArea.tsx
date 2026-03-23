import { useLayoutStore } from '@/stores/layout'
import { EditorTabs } from './EditorTabs'
import { EditorWelcome } from './EditorWelcome'
import { MockConversation } from './MockConversation'
import { MonacoTab } from './MonacoTab'

export function EditorArea(): React.JSX.Element {
  const activeTab = useLayoutStore((s) => s.activeEditorTab)

  return (
    <div className="flex h-full flex-col bg-background">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'welcome' && <EditorWelcome />}
        {activeTab === 'app.tsx' && <MonacoTab />}
        {activeTab === 'conversation' && <MockConversation />}
      </div>
    </div>
  )
}
