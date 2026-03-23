import './app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'

function initTheme(): void {
  if (!window.api) return

  window.api.getIsDark().then((isDark) => {
    document.documentElement.classList.toggle('dark', isDark)
  })

  window.api.onThemeChange((dark) => {
    document.documentElement.classList.toggle('dark', dark)
  })
}

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
