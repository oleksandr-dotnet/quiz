import { useEffect, useRef } from 'react'
import { reauthenticate } from '../api/connection'
import { useAuthStore } from '../store/authStore'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
          renderButton: (parent: HTMLElement, options: { theme: string; size: string; shape: string }) => void
        }
      }
    }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/// Renders Google's own "Sign in with Google" button via Google Identity Services (loaded in
/// index.html). On success, exchanges the Google ID token for our own access/refresh pair through
/// authStore.signIn - see design.md Decision 2 for why this token flow (not a redirect) was chosen.
export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const signIn = useAuthStore((s) => s.signIn)

  useEffect(() => {
    if (!CLIENT_ID || !containerRef.current) return

    let cancelled = false
    function tryRender() {
      if (cancelled || !window.google || !containerRef.current) {
        if (!cancelled) window.setTimeout(tryRender, 100)
        return
      }
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID!,
        callback: (response) => {
          void signIn(response.credential).then((ok) => {
            // The hub connection may already be live from an earlier anonymous
            // ensureConnected() call - re-handshake so it picks up the new token.
            if (ok) void reauthenticate()
          })
        },
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
      })
    }
    tryRender()
    return () => {
      cancelled = true
    }
  }, [signIn])

  if (!CLIENT_ID) return null

  return <div className="google-signin-row" ref={containerRef} data-testid="google-signin-button" />
}
