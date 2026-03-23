import { MockConversation } from './components/chat/MockConversation'

export function App(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <MockConversation />
    </div>
  )
}
