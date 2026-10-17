import { error, type Env } from '../lib/things'

// Shared-password auth. Set APP_PASSWORD in .dev.vars locally and as a secret in Cloudflare.
export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (!env.APP_PASSWORD) return error('APP_PASSWORD is not configured', 500)
  if (request.headers.get('Authorization') !== `Bearer ${env.APP_PASSWORD}`) {
    return error('Unauthorized', 401)
  }
  return next()
}
