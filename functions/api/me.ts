import { json, type Data, type Env } from '../lib/things'

// Used by the keypad to check a code and learn whose it is.
export const onRequestGet: PagesFunction<Env, string, Data> = async ({ data }) => json({ user: data.user })
