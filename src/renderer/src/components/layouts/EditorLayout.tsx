import { useEffect } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useLayoutStore } from '@/stores/layout'
import { TitleBar } from '@/components/title-bar/TitleBar'
import { ActivityBar } from '@/components/activity-bar/ActivityBar'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { EditorArea } from '@/components/editor/EditorArea'
import { StatusBar } from '@/components/status-bar/StatusBar'

export function EditorLayout(): React.JSX.Element {
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible)
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)
  const sidebarRef = usePanelRef()

  useEffect(() => {
    const panel = sidebarRef.current
    if (!panel) return
    if (sidebarVisible) {
      if (panel.isCollapsed()) panel.expand()
    } else {
      panel.collapse()
    }
  }, [sidebarVisible, sidebarRef])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.metaKey && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen w-screen select-none flex-col overflow-hidden bg-background">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <ActivityBar />
          <ResizablePanelGroup orientation="horizontal" id="main-layout">
            <ResizablePanel
              panelRef={sidebarRef}
              defaultSize="240px"
              minSize="160px"
              maxSize="480px"
              collapsible
              collapsedSize={0}
              id="sidebar"
            >
              <Sidebar />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize="300px" id="editor">
              <EditorArea />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <StatusBar />
      </div>
    </TooltipProvider>
  )
}
