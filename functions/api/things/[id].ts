import {
  error,
  getThing,
  insertEvent,
  isSelfOrAncestor,
  json,
  pathOf,
  validateInput,
  type Data,
  type Env,
} from '../../lib/things'

type Fn = PagesFunction<Env, 'id', Data>

export const onRequestGet: Fn = async ({ env, params }) => {
  const thing = await getThing(env.DB, params.id as string)
  return thing ? json(thing) : error('Not found', 404)
}

export const onRequestPatch: Fn = async ({ request, env, params, data }) => {
  const id = params.id as string
  const existing = await getThing(env.DB, id)
  if (!existing) return error('Not found', 404)

  const input = validateInput(await request.json().catch(() => null), true)
  if (typeof input === 'string') return error(input)

  if (input.parentId) {
    if (!(await getThing(env.DB, input.parentId))) return error('Parent not found', 404)
    if (await isSelfOrAncestor(env.DB, id, input.parentId)) return error('Cannot move a thing inside itself')
  }

  const columns: [string, unknown][] = [
    ['name', input.name],
    ['parent_id', input.parentId],
    ['notes', input.notes],
    ['tags', input.tags && JSON.stringify(input.tags)],
    ['obtained_on', input.obtainedOn],
    ['replace_by', input.replaceBy],
  ]
  const changed = columns.filter(([, v]) => v !== undefined)
  if (!changed.length) return json(existing)

  const statements = [
    env.DB.prepare(
      `UPDATE things SET ${changed.map(([col]) => `${col} = ?`).join(', ')},
         updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).bind(...changed.map(([, v]) => v), data.user, id),
  ]

  const moved = input.parentId !== undefined && input.parentId !== existing.parentId
  if (moved) {
    statements.push(
      insertEvent(env.DB, {
        thingId: id,
        kind: 'moved',
        fromPath: await pathOf(env.DB, existing.parentId),
        toPath: await pathOf(env.DB, input.parentId ?? null),
        by: data.user,
      }),
    )
  }

  await env.DB.batch(statements)
  return json(await getThing(env.DB, id))
}

// Deleting a thing moves its contents up to the deleted thing's parent.
export const onRequestDelete: Fn = async ({ env, params, data }) => {
  const thing = await getThing(env.DB, params.id as string)
  if (!thing) return error('Not found', 404)

  const { results: children } = await env.DB.prepare('SELECT id FROM things WHERE parent_id = ?')
    .bind(thing.id)
    .all<{ id: string }>()
  const fromPath = await pathOf(env.DB, thing.id)
  const toPath = await pathOf(env.DB, thing.parentId)

  await env.DB.batch([
    ...children.map((c) => insertEvent(env.DB, { thingId: c.id, kind: 'moved', fromPath, toPath, by: data.user })),
    env.DB.prepare('UPDATE things SET parent_id = ? WHERE parent_id = ?').bind(thing.parentId, thing.id),
    env.DB.prepare('DELETE FROM events WHERE thing_id = ?').bind(thing.id),
    env.DB.prepare('DELETE FROM things WHERE id = ?').bind(thing.id),
  ])
  if (thing.photoKey) await env.PHOTOS?.delete(thing.photoKey)
  return new Response(null, { status: 204 })
}
