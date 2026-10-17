export interface Thing {
  id: string
  name: string
  parentId: string | null
  notes: string
  tags: string[]
  photoKey: string | null
  createdAt: string
  updatedAt: string
}

export type ThingInput = Pick<Thing, 'name'> &
  Partial<Pick<Thing, 'parentId' | 'notes' | 'tags'>>
