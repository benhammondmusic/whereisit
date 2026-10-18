import { error, getThing, json, type Data, type Env } from '../../../lib/things'

type Fn = PagesFunction<Env, 'id', Data>

const MAX_BYTES = 5 * 1024 * 1024 // the client compresses to well under this

export const onRequestGet: Fn = async ({ env, params }) => {
  if (!env.PHOTOS) return error('Photo storage is not configured', 501)
  const thing = await getThing(env.DB, params.id as string)
  if (!thing?.photoKey) return error('Not found', 404)

  const obj = await env.PHOTOS.get(thing.photoKey)
  if (!obj) return error('Not found', 404)
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      // Keys are unique per upload, so the browser can cache forever.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}

export const onRequestPut: Fn = async ({ request, env, params, data }) => {
  if (!env.PHOTOS) return error('Photo storage is not configured', 501)
  const thing = await getThing(env.DB, params.id as string)
  if (!thing) return error('Not found', 404)

  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.startsWith('image/')) return error('Expected an image')
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_BYTES) return error('Photo is too large', 413)

  const key = `things/${thing.id}/${crypto.randomUUID()}`
  await env.PHOTOS.put(key, body, { httpMetadata: { contentType } })
  await env.DB.prepare(
    `UPDATE things SET photo_key = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  )
    .bind(key, data.user, thing.id)
    .run()
  if (thing.photoKey) await env.PHOTOS.delete(thing.photoKey)

  return json(await getThing(env.DB, thing.id))
}

export const onRequestDelete: Fn = async ({ env, params, data }) => {
  const thing = await getThing(env.DB, params.id as string)
  if (!thing) return error('Not found', 404)
  if (thing.photoKey) {
    await env.PHOTOS?.delete(thing.photoKey)
    await env.DB.prepare(
      `UPDATE things SET photo_key = NULL, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    )
      .bind(data.user, thing.id)
      .run()
  }
  return json(await getThing(env.DB, thing.id))
}
