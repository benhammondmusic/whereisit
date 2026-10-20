import type { Thing, ThingEvent, ThingInput } from './types'

const CODE_KEY = 'whereisit.code'
const USER_KEY = 'whereisit.user'

export const getCode = () => localStorage.getItem(CODE_KEY)
export const getUser = () => localStorage.getItem(USER_KEY)
export const clearLogin = () => {
  localStorage.removeItem(CODE_KEY)
  localStorage.removeItem(USER_KEY)
}

export class UnauthorizedError extends Error {}

const authHeaders = (code = getCode()) => ({ Authorization: `Bearer ${code ?? ''}` })

/** Checks a door code. Returns the user's name, or null if wrong; throws on lockout or network trouble. */
export async function login(code: string): Promise<string | null> {
  const res = await fetch('/api/me', { headers: authHeaders(code) })
  if (res.status === 401) return null
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText)
  const { user } = await res.json()
  localStorage.setItem(CODE_KEY, code)
  localStorage.setItem(USER_KEY, user)
  return user
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init.headers },
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
  events: (id: string) => request<ThingEvent[]>(`/things/${id}/events`),
  uploadPhoto: (id: string, photo: Blob) =>
    request<Thing>(`/things/${id}/photo`, { method: 'PUT', body: photo, headers: { 'Content-Type': photo.type } }),
  removePhoto: (id: string) => request<Thing>(`/things/${id}/photo`, { method: 'DELETE' }),
  /** Photos need the auth header, so fetch as a blob rather than using <img src>. */
  photoUrl: async (id: string) => {
    const res = await fetch(`/api/things/${id}/photo`, { headers: authHeaders() })
    if (!res.ok) throw new Error('Could not load photo')
    return URL.createObjectURL(await res.blob())
  },
}

/** Shrink a camera photo to a sensible size before upload. */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process photo'))), 'image/jpeg', quality),
  )
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

/** All ids inside a thing (not including itself). Used to keep a thing from being moved into its own contents. */
export function descendantIds(id: string, things: Thing[]): Set<string> {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const current = stack.pop()!
    for (const t of things) {
      if (t.parentId === current && !out.has(t.id)) {
        out.add(t.id)
        stack.push(t.id)
      }
    }
  }
  return out
}

const RECENT_KEY = 'whereisit.recentParents'

export const getRecentParents = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

export const rememberParent = (id: string | null) => {
  if (!id) return
  localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...getRecentParents().filter((p) => p !== id)].slice(0, 5)))
}
