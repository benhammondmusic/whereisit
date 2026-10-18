import { error, getThing, insertEvent, json, listThings, pathOf, validateInput, type Data, type Env } from '../../lib/things'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json(await listThings(env.DB))
}

export const onRequestPost: PagesFunction<Env, string, Data> = async ({ request, env, data }) => {
  const input = validateInput(await request.json().catch(() => null), false)
  if (typeof input === 'string') return error(input)

  if (input.parentId && !(await getThing(env.DB, input.parentId))) return error('Parent not found', 404)

  const id = crypto.randomUUID()
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO things (id, name, parent_id, notes, tags, obtained_on, replace_by, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      input.name,
      input.parentId ?? null,
      input.notes ?? '',
      JSON.stringify(input.tags ?? []),
      input.obtainedOn ?? null,
      input.replaceBy ?? null,
      data.user,
      data.user,
    ),
    insertEvent(env.DB, {
      thingId: id,
      kind: 'created',
      fromPath: null,
      toPath: await pathOf(env.DB, input.parentId ?? null),
      by: data.user,
    }),
  ])

  return json(await getThing(env.DB, id), 201)
}
