const DAY = 24 * 60 * 60 * 1000

/** Things whose replace-by date is within this many days show in "Replacing soon". */
export const SOON_DAYS = 90

export const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export function daysUntil(date: string): number {
  return Math.round((new Date(date + 'T00:00').getTime() - new Date(today() + 'T00:00').getTime()) / DAY)
}

export const isReplaceSoon = (replaceBy: string | null) => replaceBy !== null && daysUntil(replaceBy) <= SOON_DAYS

export function describeReplaceBy(date: string): string {
  const d = daysUntil(date)
  if (d < 0) return `Overdue by ${-d} day${d === -1 ? '' : 's'}`
  if (d === 0) return 'Replace today'
  if (d < 60) return `Replace in ${d} day${d === 1 ? '' : 's'}`
  return `Replace by ${formatDate(date)}`
}

export const formatDate = (date: string) =>
  new Date(date + (date.length === 10 ? 'T00:00' : '')).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

/** "3 years, 2 months" since a date. */
export function age(date: string): string {
  const from = new Date(date + 'T00:00')
  const now = new Date()
  let months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth()
  if (now.getDate() < from.getDate()) months--
  if (months < 1) return 'less than a month'
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y && `${y} year${y === 1 ? '' : 's'}`, m && `${m} month${m === 1 ? '' : 's'}`].filter(Boolean).join(', ')
}
