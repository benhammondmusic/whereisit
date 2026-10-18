import { useState } from 'react'
import { isReplaceSoon } from '../dates'
import type { Thing } from '../types'

interface Props {
  parentId: string | null
  childrenOf: Map<string | null, Thing[]>
  onOpen: (thing: Thing) => void
  onAddInside: (parentId: string) => void
}

export default function Tree({ parentId, childrenOf, onOpen, onAddInside }: Props) {
  const kids = childrenOf.get(parentId)
  if (!kids?.length) return null
  return (
    <ul className="tree">
      {kids.map((t) => (
        <Node key={t.id} thing={t} childrenOf={childrenOf} onOpen={onOpen} onAddInside={onAddInside} />
      ))}
    </ul>
  )
}

function Node({ thing, ...props }: Omit<Props, 'parentId'> & { thing: Thing }) {
  const count = props.childrenOf.get(thing.id)?.length ?? 0
  const [open, setOpen] = useState(false)
  return (
    <li>
      <div className="row">
        <button
          className="caret"
          onClick={() => setOpen(!open)}
          aria-label={open ? `Collapse ${thing.name}` : `Expand ${thing.name}`}
          aria-expanded={open}
          disabled={!count}
        >
          {count ? (open ? '▾' : '▸') : ''}
        </button>
        <button className="name" onClick={() => props.onOpen(thing)}>
          {thing.name}
          {count > 0 && <span className="count">{count}</span>}
          {isReplaceSoon(thing.replaceBy) && <span className="badge" title="Replacing soon">⏳</span>}
        </button>
        <button className="link add-inside" onClick={() => props.onAddInside(thing.id)} aria-label={`Add inside ${thing.name}`}>+</button>
      </div>
      {open && <Tree parentId={thing.id} {...props} />}
    </li>
  )
}
