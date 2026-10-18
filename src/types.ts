export interface Thing {
  id: string
  name: string
  parentId: string | null
  notes: string
  tags: string[]
  photoKey: string | null
  obtainedOn: string | null // YYYY-MM-DD
  replaceBy: string | null // YYYY-MM-DD
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type ThingInput = Pick<Thing, 'name'> &
  Partial<Pick<Thing, 'parentId' | 'notes' | 'tags' | 'obtainedOn' | 'replaceBy'>>

export interface ThingEvent {
  id: number
  thingId: string
  kind: 'created' | 'moved'
  fromPath: string | null
  toPath: string | null
  by: string | null
  at: string
}
