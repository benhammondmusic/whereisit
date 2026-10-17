import type { Thing, ThingInput } from '../../src/types'

export interface Env {
  DB: D1Database
  APP_PASSWORD?: string
}

interface ThingRow {
  id: string
  name: string
  parent_id: string | null
  notes: string
  tags: string
  photo_key: string | null
  created_at: string
  updated_at: string
}

export function toThing(row: ThingRow): Thing {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    notes: row.notes,
    tags: JSON.parse(row.tags),
    photoKey: row.photo_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getThing(db: D1Database, id: string): Promise<Thing | null> {
  const row = await db.prepare('SELECT * FROM things WHERE id = ?').bind(id).first<ThingRow>()
  return row ? toThing(row) : null
}

export async function listThings(db: D1Database): Promise<Thing[]> {
  const { results } = await db.prepare('SELECT * FROM things ORDER BY name COLLATE NOCASE').all<ThingRow>()
  return results.map(toThing)
}

/** True if `ancestorId` is `id` or sits anywhere above it. Used to block cycles on move. */
export async function isSelfOrAncestor(db: D1Database, ancestorId: string, id: string): Promise<boolean> {
  const row = await db
    .prepare(
      `WITH RECURSIVE up(id, parent_id) AS (
         SELECT id, parent_id FROM things WHERE id = ?
         UNION ALL
         SELECT t.id, t.parent_id FROM things t JOIN up ON t.id = up.parent_id
       )
       SELECT 1 FROM up WHERE id = ? LIMIT 1`,
    )
    .bind(id, ancestorId)
    .first()
  return row !== null
}

export function validateInput(body: unknown, partial: boolean): Partial<ThingInput> | string {
  if (typeof body !== 'object' || body === null) return 'Body must be a JSON object'
  const b = body as Record<string, unknown>
  const out: Partial<ThingInput> = {}

  if (b.name !== undefined || !partial) {
    if (typeof b.name !== 'string' || !b.name.trim()) return 'name is required'
    out.name = b.name.trim()
  }
  if (b.parentId !== undefined) {
    if (b.parentId !== null && typeof b.parentId !== 'string') return 'parentId must be a string or null'
    out.parentId = b.parentId
  }
  if (b.notes !== undefined) {
    if (typeof b.notes !== 'string') return 'notes must be a string'
    out.notes = b.notes
  }
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === 'string')) return 'tags must be an array of strings'
    out.tags = b.tags
  }
  return out
}

export const json = (data: unknown, status = 200) => Response.json(data, { status })
export const error = (message: string, status = 400) => json({ error: message }, status)
