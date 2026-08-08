import type { RecapPayload, RecapSummary } from './contracts'

// Anonymous sharing stays possible (no Authorization header required) - attaching the bearer token
// when present is what lets the server attribute the share to a signed-in account (see
// add-shareable-game-recap's design.md).
export async function shareRecap(payload: RecapPayload, accessToken: string | null): Promise<string | null> {
  const res = await fetch('/api/recaps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ payload }),
  })
  if (!res.ok) return null
  const body = (await res.json()) as { id: string }
  return body.id
}

export async function fetchRecap(id: string): Promise<RecapPayload | null> {
  const res = await fetch(`/api/recaps/${id}`)
  return res.ok ? ((await res.json()) as RecapPayload) : null
}

export async function fetchMyRecaps(accessToken: string): Promise<RecapSummary[] | null> {
  const res = await fetch('/api/recaps/mine', { headers: { Authorization: `Bearer ${accessToken}` } })
  return res.ok ? ((await res.json()) as RecapSummary[]) : null
}
