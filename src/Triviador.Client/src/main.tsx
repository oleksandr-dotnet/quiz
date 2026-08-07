import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RotatePrompt } from './components/RotatePrompt'
import { AmbientLifeBackground } from './components/AmbientLifeBackground'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AmbientLifeBackground />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <RotatePrompt />
  </StrictMode>,
)
