import type { AccountProfileDto } from './contracts'

export interface AuthResponse {
  accessToken: string
  accessTokenExpiresAtUtc: string
  profile: AccountProfileDto
}

// The refresh/logout cookie is HttpOnly - the browser attaches it automatically (credentials:
// 'include'); this header is the CSRF guard design.md Decision 5 relies on, since a cross-site
// form/navigation can't set a custom header.
const REQUESTED_WITH = { 'X-Requested-With': 'XMLHttpRequest' }

export async function signInWithGoogle(idToken: string): Promise<AuthResponse | null> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  })
  return res.ok ? ((await res.json()) as AuthResponse) : null
}

export async function refreshSession(): Promise<AuthResponse | null> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: REQUESTED_WITH,
    credentials: 'include',
  })
  return res.ok ? ((await res.json()) as AuthResponse) : null
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', headers: REQUESTED_WITH, credentials: 'include' })
}

export async function setUsername(
  accessToken: string,
  username: string,
): Promise<{ ok: true; profile: AccountProfileDto } | { ok: false; error: 'InvalidUsername' | 'UsernameTaken' }> {
  const res = await fetch('/api/auth/username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ username }),
  })
  if (res.ok) return { ok: true, profile: (await res.json()) as AccountProfileDto }
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return { ok: false, error: body?.error === 'UsernameTaken' ? 'UsernameTaken' : 'InvalidUsername' }
}

export async function setAvatar(accessToken: string, avatarId: string): Promise<AccountProfileDto | null> {
  const res = await fetch('/api/auth/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ avatarId }),
  })
  return res.ok ? ((await res.json()) as AccountProfileDto) : null
}
