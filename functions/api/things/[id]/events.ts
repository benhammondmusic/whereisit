import { json, listEvents, type Env } from '../../../lib/things'

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ env, params }) => {
  return json(await listEvents(env.DB, params.id as string))
}
