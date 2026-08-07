import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RotatePrompt } from './components/RotatePrompt'
import { AmbientBattleBackground } from './components/AmbientBattleBackground'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AmbientBattleBackground />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <RotatePrompt />
  </StrictMode>,
)
