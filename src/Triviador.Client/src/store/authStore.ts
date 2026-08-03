import { create } from 'zustand'
import { logout as apiLogout, refreshSession, signInWithGoogle } from '../api/authApi'
import type { AccountProfileDto } from '../api/contracts'

interface AuthStore {
  accessToken: string | null
  profile: AccountProfileDto | null
  // Distinguishes "haven't tried the silent restore yet" from "tried it, not signed in" - the
  // landing screen shouldn't flash a sign-in button before the first refresh attempt resolves.
  restoreAttempted: boolean
  signIn: (googleIdToken: string) => Promise<boolean>
  restoreSession: () => Promise<void>
  setProfile: (profile: AccountProfileDto) => void
  signOut: () => Promise<void>
}

// Access token lives only in memory - never localStorage/sessionStorage (design.md Decision 4).
// It's lost on a hard refresh by design; restoreSession() replaces it via the HttpOnly refresh
// cookie, which is the actual persistence mechanism.
export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  profile: null,
  restoreAttempted: false,
  signIn: async (googleIdToken) => {
    const result = await signInWithGoogle(googleIdToken)
    if (!result) return false
    set({ accessToken: result.accessToken, profile: result.profile, restoreAttempted: true })
    return true
  },
  restoreSession: async () => {
    const result = await refreshSession()
    set({
      accessToken: result?.accessToken ?? null,
      profile: result?.profile ?? null,
      restoreAttempted: true,
    })
  },
  setProfile: (profile) => set({ profile }),
  signOut: async () => {
    await apiLogout()
    set({ accessToken: null, profile: null })
  },
}))
