import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface ErrorFallbackProps {
  onReload: () => void
}

function ErrorFallback({ onReload }: ErrorFallbackProps) {
  const { t } = useTranslation()
  return (
    <div className="error-boundary-fallback">
      <div className="paper-card error-boundary-card">
        <h1>{t('errorBoundary.title')}</h1>
        <p>{t('errorBoundary.message')}</p>
        <button type="button" className="primary" onClick={onReload}>
          {t('errorBoundary.reload')}
        </button>
      </div>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// Catches render errors anywhere in the app tree so one crashing component degrades to a themed
// fallback instead of unmounting the whole React tree to a blank page. Class-only API - hooks
// (getDerivedStateFromError/componentDidCatch) have no function-component equivalent.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={() => window.location.reload()} />
    }
    return this.props.children
  }
}
