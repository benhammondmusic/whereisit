import { error, getThing, json, listThings, validateInput, type Env } from '../../lib/things'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json(await listThings(env.DB))
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const input = validateInput(await request.json().catch(() => null), false)
  if (typeof input === 'string') return error(input)

  if (input.parentId && !(await getThing(env.DB, input.parentId))) return error('Parent not found', 404)

  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO things (id, name, parent_id, notes, tags) VALUES (?, ?, ?, ?, ?)')
    .bind(id, input.name, input.parentId ?? null, input.notes ?? '', JSON.stringify(input.tags ?? []))
    .run()

  return json(await getThing(env.DB, id), 201)
}
