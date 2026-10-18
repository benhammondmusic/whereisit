import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { api, compressPhoto, descendantIds, getRecentParents, pathOf, rememberParent } from '../api'
import { age, describeReplaceBy, formatDate } from '../dates'
import type { Thing, ThingEvent, ThingInput } from '../types'

export type SheetMode = { kind: 'new'; parentId: string | null } | { kind: 'edit'; thing: Thing }

interface Props {
  mode: SheetMode
  things: Thing[]
  byId: Map<string, Thing>
  /** Runs an API call, refreshes the list, and reports errors. Resolves false on failure. */
  run: (fn: () => Promise<unknown>) => Promise<boolean>
  onClose: () => void
  onOpen: (thing: Thing) => void
}

export default function ThingSheet({ mode, things, byId, run, onClose, onOpen }: Props) {
  const existing = mode.kind === 'edit' ? mode.thing : null
  const dialog = useRef<HTMLDialogElement>(null)

  const [name, setName] = useState(existing?.name ?? '')
  const [parentId, setParentId] = useState(() => {
    if (existing) return existing.parentId ?? ''
    if (mode.kind === 'new' && mode.parentId) return mode.parentId
    return getRecentParents().find((id) => byId.has(id)) ?? ''
  })
  const [obtainedOn, setObtainedOn] = useState(existing?.obtainedOn ?? '')
  const [replaceBy, setReplaceBy] = useState(existing?.replaceBy ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '')
  const [showMore, setShowMore] = useState(Boolean(existing && (existing.notes || existing.tags.length || existing.obtainedOn || existing.replaceBy)))
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [events, setEvents] = useState<ThingEvent[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  // Load the existing photo and history.
  useEffect(() => {
    if (!existing) return
    let url: string | null = null
    if (existing.photoKey) {
      api.photoUrl(existing.id).then((u) => setPhotoUrl((url = u)), () => {})
    }
    api.events(existing.id).then(setEvents, () => {})
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [existing])

  const options = useMemo(() => {
    const blocked = existing ? descendantIds(existing.id, things).add(existing.id) : new Set<string>()
    const all = things
      .filter((t) => !blocked.has(t.id))
      .map((t) => ({ id: t.id, label: pathOf(t, byId) }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const recent = getRecentParents()
      .map((id) => all.find((o) => o.id === id))
      .filter((o) => o !== undefined)
    return { all, recent }
  }, [things, byId, existing])

  const children = existing ? things.filter((t) => t.parentId === existing.id) : []

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    try {
      const blob = await compressPhoto(file)
      setPhoto(blob)
      setRemovePhoto(false)
      setPhotoUrl(URL.createObjectURL(blob))
    } catch {
      alert('Could not read that photo')
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    const input: ThingInput = {
      name: name.trim(),
      parentId: parentId || null,
      obtainedOn: obtainedOn || null,
      replaceBy: replaceBy || null,
      notes,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    const ok = await run(async () => {
      const saved = existing ? await api.update(existing.id, input) : await api.create(input)
      if (photo) await api.uploadPhoto(saved.id, photo)
      else if (removePhoto && existing?.photoKey) await api.removePhoto(saved.id)
    })
    setBusy(false)
    if (ok) {
      rememberParent(input.parentId ?? null)
      onClose()
    }
  }

  async function remove() {
    if (!existing) return
    setBusy(true)
    const ok = await run(() => api.remove(existing.id))
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <form onSubmit={save}>
        <div className="sheet-head">
          <h2>{existing ? 'Edit' : 'Add something'}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="photo-field">
          {photoUrl && !removePhoto ? (
            <>
              <img src={photoUrl} alt="" />
              <div className="photo-actions">
                <label className="button secondary">
                  Replace
                  <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </label>
                <button type="button" className="secondary" onClick={() => (setRemovePhoto(true), setPhoto(null))}>Remove</button>
              </div>
            </>
          ) : (
            <label className="button secondary photo-add">
              📷 Add photo
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>
          )}
        </div>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!existing} required placeholder="e.g. Passport" />
        </label>

        <label className="field">
          <span>Where is it?</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Nowhere (top level)</option>
            {options.recent.length > 0 && (
              <optgroup label="Recent">
                {options.recent.map((o) => (
                  <option key={'r' + o.id} value={o.id}>{o.label}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="All">
              {options.all.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        </label>

        {showMore ? (
          <>
            <div className="field-row">
              <label className="field">
                <span>Date obtained</span>
                <input type="date" value={obtainedOn} onChange={(e) => setObtainedOn(e.target.value)} />
              </label>
              <label className="field">
                <span>Replace by</span>
                <input type="date" value={replaceBy} onChange={(e) => setReplaceBy(e.target.value)} />
              </label>
            </div>
            {(obtainedOn || replaceBy) && (
              <p className="hint">
                {[obtainedOn && `${age(obtainedOn)} old`, replaceBy && describeReplaceBy(replaceBy)].filter(Boolean).join(' · ')}
              </p>
            )}
            <label className="field">
              <span>Notes</span>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <label className="field">
              <span>Tags</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="travel, documents" />
            </label>
          </>
        ) : (
          <button type="button" className="link more" onClick={() => setShowMore(true)}>+ Dates, notes, tags</button>
        )}

        <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save' : 'Add'}</button>

        {existing && (
          <>
            {children.length > 0 && (
              <section>
                <h3>Contains ({children.length})</h3>
                <ul className="chips">
                  {children.map((c) => (
                    <li key={c.id}>
                      <button type="button" className="chip" onClick={() => onOpen(c)}>{c.name}</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {events.length > 0 && (
              <section>
                <h3>History</h3>
                <ul className="history">
                  {events.map((ev) => (
                    <li key={ev.id}>
                      {ev.kind === 'created' ? `Added to ${ev.toPath ?? 'top level'}` : `Moved from ${ev.fromPath ?? 'top level'} to ${ev.toPath ?? 'top level'}`}
                      <span className="muted"> · {ev.by ? `${ev.by}, ` : ''}{formatDate(ev.at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="danger-zone">
              {confirmDelete ? (
                <>
                  <span>Delete {existing.name}?{children.length > 0 && ' Its contents move up a level.'}</span>
                  <button type="button" className="danger" onClick={remove} disabled={busy}>Delete</button>
                  <button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </>
              ) : (
                <button type="button" className="link danger-text" onClick={() => setConfirmDelete(true)}>Delete</button>
              )}
            </div>
          </>
        )}
      </form>
    </dialog>
  )
}
