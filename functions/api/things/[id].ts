import { error, getThing, isSelfOrAncestor, json, validateInput, type Env } from '../../lib/things'

type Ctx = EventContext<Env, 'id', unknown>

const idOf = (params: Ctx['params']) => params.id as string

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ env, params }) => {
  const thing = await getThing(env.DB, idOf(params))
  return thing ? json(thing) : error('Not found', 404)
}

export const onRequestPatch: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const id = idOf(params)
  if (!(await getThing(env.DB, id))) return error('Not found', 404)

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
  ]
  const changed = columns.filter(([, v]) => v !== undefined)
  const sets = changed.map(([col]) => `${col} = ?`)
  const values = changed.map(([, v]) => v)

  if (sets.length) {
    await env.DB.prepare(
      `UPDATE things SET ${sets.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    )
      .bind(...values, id)
      .run()
  }
  return json(await getThing(env.DB, id))
}

// Deleting a thing moves its contents up to the deleted thing's parent.
export const onRequestDelete: PagesFunction<Env, 'id'> = async ({ env, params }) => {
  const thing = await getThing(env.DB, idOf(params))
  if (!thing) return error('Not found', 404)

  await env.DB.batch([
    env.DB.prepare('UPDATE things SET parent_id = ? WHERE parent_id = ?').bind(thing.parentId, thing.id),
    env.DB.prepare('DELETE FROM things WHERE id = ?').bind(thing.id),
  ])
  return new Response(null, { status: 204 })
}
