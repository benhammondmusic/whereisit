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
        {/* Tapping a container expands it; tapping a plain item opens it for editing. */}
        <button
          className="name"
          onClick={() => (count ? setOpen(!open) : props.onOpen(thing))}
          aria-expanded={count ? open : undefined}
        >
          <span className="caret" aria-hidden>{count ? (open ? '▾' : '▸') : ''}</span>
          {thing.name}
          {count > 0 && <span className="count">{count}</span>}
          {isReplaceSoon(thing.replaceBy) && <span className="badge" title="Replacing soon">⏳</span>}
        </button>
        <button className="icon" onClick={() => props.onAddInside(thing.id)} aria-label={`Add something to ${thing.name}`} title="Add something to this">
          <AddWithinIcon />
        </button>
        <button className="icon" onClick={() => props.onOpen(thing)} aria-label={`Edit ${thing.name}`} title="Edit">
          <EditIcon />
        </button>
      </div>
      {open && <Tree parentId={thing.id} {...props} />}
    </li>
  )
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** A box with a plus inside it. */
function AddWithinIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M3 8l2-4h14l2 4" />
      <rect x="3" y="8" width="18" height="12" rx="1" />
      <path d="M12 11v6M9 14h6" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}
