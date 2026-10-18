import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, clearLogin, getPassword, getUser, pathOf, saveLogin, UnauthorizedError } from './api'
import ThingSheet, { type SheetMode } from './components/ThingSheet'
import Tree from './components/Tree'
import { describeReplaceBy, isReplaceSoon, today } from './dates'
import { search } from './search'
import type { Thing } from './types'
import './App.css'

const locationOf = (thing: Thing, byId: Map<string, Thing>) => {
  const parent = thing.parentId ? byId.get(thing.parentId) : undefined
  return parent ? pathOf(parent, byId) : 'Top level'
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getPassword() && getUser()))
  const logout = useCallback(() => {
    clearLogin()
    setAuthed(false)
  }, [])
  return authed ? <Home onLogout={logout} /> : <Login onLogin={() => setAuthed(true)} />
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(getUser() ?? '')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    saveLogin(password, user.trim())
    onLogin()
  }
  return (
    <main className="login">
      <h1>Where Is It</h1>
      <form onSubmit={submit}>
        <input placeholder="Your name" value={user} onChange={(e) => setUser(e.target.value)} required autoFocus={!user} />
        <input type="password" placeholder="Household password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus={Boolean(user)} />
        <button type="submit" className="primary">Enter</button>
      </form>
    </main>
  )
}

function Home({ onLogout }: { onLogout: () => void }) {
  const [things, setThings] = useState<Thing[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState<SheetMode | null>(null)

  const fail = useCallback(
    (e: unknown) => (e instanceof UnauthorizedError ? onLogout() : setError((e as Error).message)),
    [onLogout],
  )

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
        setThings(await api.list())
        setError(null)
        return true
      } catch (e) {
        fail(e)
        return false
      }
    },
    [fail],
  )

  useEffect(() => {
    api.list().then(setThings, fail).finally(() => setLoaded(true))
  }, [fail])

  const byId = useMemo(() => new Map(things.map((t) => [t.id, t])), [things])
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Thing[]>()
    for (const t of things) {
      const key = t.parentId && byId.has(t.parentId) ? t.parentId : null
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return map
  }, [things, byId])

  const results = useMemo(() => (query.trim() ? search(query, things, byId) : null), [query, things, byId])
  const replaceSoon = useMemo(
    () => things.filter((t) => isReplaceSoon(t.replaceBy)).sort((a, b) => a.replaceBy!.localeCompare(b.replaceBy!)),
    [things],
  )

  const open = (thing: Thing) => setSheet({ kind: 'edit', thing })

  return (
    <main>
      <header>
        <h1>Where Is It</h1>
        <span className="muted">
          {getUser()} · <button className="link inline" onClick={onLogout}>Log out</button>
        </span>
      </header>

      <input className="search" type="search" placeholder="Find something…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {error && <p className="error">{error}</p>}

      {results ? (
        <ul className="results">
          {results.map(({ thing }) => (
            <li key={thing.id}>
              <button onClick={() => open(thing)}>
                <strong>{thing.name}</strong>
                <span className="muted">{locationOf(thing, byId)}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="muted empty">Nothing found</li>}
        </ul>
      ) : (
        <>
          {replaceSoon.length > 0 && (
            <section className="soon">
              <h2>Replacing soon</h2>
              <ul>
                {replaceSoon.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => open(t)}>
                      <strong>{t.name}</strong>
                      <span className="muted">{locationOf(t, byId)}</span>
                      <span className={t.replaceBy! < today() ? 'error' : 'muted'}>{describeReplaceBy(t.replaceBy!)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {loaded && things.length === 0 && (
            <p className="muted empty">Nothing here yet. Tap + to add a room, like “Garage” or “Kitchen”.</p>
          )}
          <Tree
            parentId={null}
            childrenOf={childrenOf}
            onOpen={open}
            onAddInside={(parentId) => setSheet({ kind: 'new', parentId })}
          />
        </>
      )}

      <button className="fab" onClick={() => setSheet({ kind: 'new', parentId: null })} aria-label="Add something">+</button>

      {sheet && (
        <ThingSheet
          key={sheet.kind === 'edit' ? sheet.thing.id : 'new:' + sheet.parentId}
          mode={sheet}
          things={things}
          byId={byId}
          run={run}
          onClose={() => setSheet(null)}
          onOpen={open}
        />
      )}
    </main>
  )
}
