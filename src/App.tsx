import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, clearPassword, getPassword, pathOf, setPassword, UnauthorizedError } from './api'
import type { Thing } from './types'
import './App.css'

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getPassword()))
  const logout = useCallback(() => {
    clearPassword()
    setAuthed(false)
  }, [])
  return authed ? <Home onLogout={logout} /> : <Login onLogin={() => setAuthed(true)} />
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setPassword(value)
    onLogin()
  }
  return (
    <main className="login">
      <h1>Where Is It</h1>
      <form onSubmit={submit}>
        <input type="password" placeholder="Password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <button type="submit">Enter</button>
      </form>
    </main>
  )
}

function Home({ onLogout }: { onLogout: () => void }) {
  const [things, setThings] = useState<Thing[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
        setThings(await api.list())
        setError(null)
      } catch (e) {
        if (e instanceof UnauthorizedError) onLogout()
        else setError((e as Error).message)
      }
    },
    [onLogout],
  )

  useEffect(() => {
    api.list().then(setThings, (e) => (e instanceof UnauthorizedError ? onLogout() : setError(e.message)))
  }, [onLogout])

  const byId = useMemo(() => new Map(things.map((t) => [t.id, t])), [things])
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Thing[]>()
    for (const t of things) {
      const key = t.parentId && byId.has(t.parentId) ? t.parentId : null
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return map
  }, [things, byId])

  const matches = query.trim()
    ? things.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    : null

  return (
    <main>
      <header>
        <h1>Where Is It</h1>
        <button className="link" onClick={onLogout}>Log out</button>
      </header>

      <input className="search" type="search" placeholder="Find something…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {error && <p className="error">{error}</p>}

      {matches ? (
        <ul className="results">
          {matches.map((t) => (
            <li key={t.id}>{pathOf(t, byId)}</li>
          ))}
          {matches.length === 0 && <li className="muted">Nothing found</li>}
        </ul>
      ) : (
        <>
          <AddForm things={things} byId={byId} onAdd={(name, parentId) => run(() => api.create({ name, parentId }))} />
          <Tree parentId={null} childrenOf={childrenOf} onDelete={(id) => run(() => api.remove(id))} />
        </>
      )}
    </main>
  )
}

function AddForm({
  things,
  byId,
  onAdd,
}: {
  things: Thing[]
  byId: Map<string, Thing>
  onAdd: (name: string, parentId: string | null) => void
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const options = useMemo(
    () => things.map((t) => ({ id: t.id, label: pathOf(t, byId) })).sort((a, b) => a.label.localeCompare(b.label)),
    [things, byId],
  )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim(), parentId || null)
    setName('')
  }
  return (
    <form className="add" onSubmit={submit}>
      <input placeholder="New thing" value={name} onChange={(e) => setName(e.target.value)} />
      <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">(top level)</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <button type="submit">Add</button>
    </form>
  )
}

function Tree({
  parentId,
  childrenOf,
  onDelete,
}: {
  parentId: string | null
  childrenOf: Map<string | null, Thing[]>
  onDelete: (id: string) => void
}) {
  const kids = childrenOf.get(parentId)
  if (!kids?.length) return parentId === null ? <p className="muted">Nothing here yet. Add a room to start.</p> : null
  return (
    <ul className="tree">
      {kids.map((t) => (
        <li key={t.id}>
          <div className="row">
            <span>{t.name}</span>
            <button className="link" onClick={() => onDelete(t.id)} aria-label={`Delete ${t.name}`}>✕</button>
          </div>
          <Tree parentId={t.id} childrenOf={childrenOf} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  )
}
