import { pathOf } from './api'
import type { Thing } from './types'

export interface SearchResult {
  thing: Thing
  path: string
  score: number
}

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** Edit distance, capped: returns early once it's clearly above `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    if (Math.min(...cur) > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** How well one query token matches one word: 3 exact/prefix, 2 substring, 1 typo, 0 none. */
function tokenScore(token: string, word: string): number {
  if (word.startsWith(token)) return 3
  if (word.includes(token)) return 2
  if (token.length >= 4) {
    const allowed = token.length >= 7 ? 2 : 1
    if (distance(token, word.slice(0, token.length), allowed) <= allowed) return 1
    if (distance(token, word, allowed) <= allowed) return 1
  }
  return 0
}

/**
 * Every query word must match somewhere in the thing's name, tags, notes, or location.
 * Matches in the name count most. Tolerates small typos ("pasport", "batteris").
 */
export function search(query: string, things: Thing[], byId: Map<string, Thing>): SearchResult[] {
  const tokens = words(query)
  if (!tokens.length) return []

  const results: SearchResult[] = []
  for (const thing of things) {
    const path = pathOf(thing, byId)
    const fields: [string[], number][] = [
      [words(thing.name), 3],
      [thing.tags.flatMap(words), 2],
      [words(thing.notes), 1],
      [words(path), 1],
    ]
    let score = 0
    let all = true
    for (const token of tokens) {
      let best = 0
      for (const [ws, weight] of fields) {
        for (const w of ws) best = Math.max(best, tokenScore(token, w) * weight)
      }
      if (!best) {
        all = false
        break
      }
      score += best
    }
    if (all) results.push({ thing, path, score })
  }
  return results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 50)
}
