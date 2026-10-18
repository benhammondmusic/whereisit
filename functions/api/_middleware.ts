import { error, type Data, type Env } from '../lib/things'

// Shared-password auth. Set APP_PASSWORD in .dev.vars locally and as a secret in Cloudflare.
// X-User is who's making the change (for history); it's trusted, not authenticated.
export const onRequest: PagesFunction<Env, string, Data> = async ({ request, env, data, next }) => {
  if (!env.APP_PASSWORD) return error('APP_PASSWORD is not configured', 500)
  if (request.headers.get('Authorization') !== `Bearer ${env.APP_PASSWORD}`) {
    return error('Unauthorized', 401)
  }
  data.user = request.headers.get('X-User')?.trim().slice(0, 40) || null
  return next()
}
