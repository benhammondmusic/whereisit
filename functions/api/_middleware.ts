import { error, type Data, type Env } from '../lib/things'

const MAX_FAILURES = 20
const WINDOW = '-15 minutes'

/** USER_CODES is "0000:Name,000000:Other" — a secret, since the repo is public. */
function userForCode(env: Env, code: string): string | null {
  for (const entry of (env.USER_CODES ?? '').split(',')) {
    const [c, name] = entry.split(':').map((s) => s.trim())
    if (c && name && c === code) return name
  }
  return null
}

// Door-code auth: the code in `Authorization: Bearer <code>` identifies the user.
// Too many wrong codes from one IP locks it out for a while.
export const onRequest: PagesFunction<Env, string, Data> = async ({ request, env, data, next }) => {
  if (!env.USER_CODES) return error('USER_CODES is not configured', 500)

  const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
  const failures = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM login_failures WHERE ip = ? AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)`,
  )
    .bind(ip, WINDOW)
    .first<{ n: number }>()
  if ((failures?.n ?? 0) >= MAX_FAILURES) return error('Too many wrong codes. Try again in 15 minutes.', 429)

  const code = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  const user = userForCode(env, code)
  if (!user) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_failures (ip) VALUES (?)').bind(ip),
      env.DB.prepare(`DELETE FROM login_failures WHERE at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`),
    ])
    return error('Wrong code', 401)
  }

  data.user = user
  return next()
}
