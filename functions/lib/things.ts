import type { Thing, ThingEvent, ThingInput } from '../../src/types'

export interface Env {
  DB: D1Database
  PHOTOS?: R2Bucket
  USER_CODES?: string
}

/** Set by the auth middleware from the door code. */
export interface Data extends Record<string, unknown> {
  user: string
}

interface ThingRow {
  id: string
  name: string
  parent_id: string | null
  notes: string
  tags: string
  photo_key: string | null
  obtained_on: string | null
  replace_by: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

interface EventRow {
  id: number
  thing_id: string
  kind: ThingEvent['kind']
  from_path: string | null
  to_path: string | null
  by: string | null
  at: string
}

export function toThing(row: ThingRow): Thing {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    notes: row.notes,
    tags: JSON.parse(row.tags),
    photoKey: row.photo_key,
    obtainedOn: row.obtained_on,
    replaceBy: row.replace_by,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toEvent = (row: EventRow): ThingEvent => ({
  id: row.id,
  thingId: row.thing_id,
  kind: row.kind,
  fromPath: row.from_path,
  toPath: row.to_path,
  by: row.by,
  at: row.at,
})

export async function getThing(db: D1Database, id: string): Promise<Thing | null> {
  const row = await db.prepare('SELECT * FROM things WHERE id = ?').bind(id).first<ThingRow>()
  return row ? toThing(row) : null
}

export async function listThings(db: D1Database): Promise<Thing[]> {
  const { results } = await db.prepare('SELECT * FROM things ORDER BY name COLLATE NOCASE').all<ThingRow>()
  return results.map(toThing)
}

export async function listEvents(db: D1Database, thingId: string): Promise<ThingEvent[]> {
  const { results } = await db
    .prepare('SELECT * FROM events WHERE thing_id = ? ORDER BY at DESC, id DESC LIMIT 50')
    .bind(thingId)
    .all<EventRow>()
  return results.map(toEvent)
}

/** "Garage › Attic Shelf" for a thing id, or null for top level. */
export async function pathOf(db: D1Database, id: string | null): Promise<string | null> {
  if (!id) return null
  const row = await db
    .prepare(
      `WITH RECURSIVE up(id, parent_id, name, depth) AS (
         SELECT id, parent_id, name, 0 FROM things WHERE id = ?
         UNION ALL
         SELECT t.id, t.parent_id, t.name, up.depth + 1 FROM things t JOIN up ON t.id = up.parent_id WHERE up.depth < 50
       )
       SELECT group_concat(name, ' › ') AS path FROM (SELECT name FROM up ORDER BY depth DESC)`,
    )
    .bind(id)
    .first<{ path: string | null }>()
  return row?.path ?? null
}

export const insertEvent = (
  db: D1Database,
  e: { thingId: string; kind: ThingEvent['kind']; fromPath: string | null; toPath: string | null; by: string | null },
) =>
  db
    .prepare('INSERT INTO events (thing_id, kind, from_path, to_path, by) VALUES (?, ?, ?, ?, ?)')
    .bind(e.thingId, e.kind, e.fromPath, e.toPath, e.by)

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

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

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
    out.tags = b.tags.map((t) => t.trim()).filter(Boolean)
  }
  for (const key of ['obtainedOn', 'replaceBy'] as const) {
    if (b[key] === undefined) continue
    if (b[key] !== null && !isDate(b[key])) return `${key} must be YYYY-MM-DD or null`
    out[key] = b[key] as string | null
  }
  return out
}

export const json = (data: unknown, status = 200) => Response.json(data, { status })
export const error = (message: string, status = 400) => json({ error: message }, status)
