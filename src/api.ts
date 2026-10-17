import type { Thing, ThingInput } from './types'

const PASSWORD_KEY = 'whereisit.password'

export const getPassword = () => localStorage.getItem(PASSWORD_KEY)
export const setPassword = (p: string) => localStorage.setItem(PASSWORD_KEY, p)
export const clearPassword = () => localStorage.removeItem(PASSWORD_KEY)

export class UnauthorizedError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPassword() ?? ''}`,
      ...init.headers,
    },
  })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText)
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  list: () => request<Thing[]>('/things'),
  create: (input: ThingInput) => request<Thing>('/things', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<ThingInput>) =>
    request<Thing>(`/things/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/things/${id}`, { method: 'DELETE' }),
}

/** "Garage › Attic Shelf › Suitcase" for a thing, walking up parents. */
export function pathOf(thing: Thing, byId: Map<string, Thing>): string {
  const names: string[] = []
  for (let t: Thing | undefined = thing; t; t = t.parentId ? byId.get(t.parentId) : undefined) {
    names.unshift(t.name)
    if (names.length > 50) break // guard against bad data
  }
  return names.join(' › ')
}
