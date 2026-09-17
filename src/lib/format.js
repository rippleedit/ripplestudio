// "2026-09-12 18:54:11" (SQLite) is not a date every browser parses; make it ISO first.
// A bare "2026-09-12" is a calendar day, so it is read as local midnight, not UTC.
export const toDate = (value) => {
  if (value instanceof Date) return value
  const text = String(value ?? '')
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
  return new Date(/^\d{4}-\d{2}-\d{2} \d/.test(text) ? text.replace(' ', 'T') : text)
}

export const shortDate = (value) => (value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(toDate(value)) : '')

export const money = (value, currency = 'EUR') => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-GB', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(value || 0))

export const usd = (value) => money(value, 'USD')

export const projectMoney = (value, currency = 'USD') => (value == null || value === '' ? '' : money(value, currency))

export const dateLabel = (value) => (value ? new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
}).format(toDate(value)) : 'Not set')

export const monthLabel = (value) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(toDate(value))

export const relativeDays = (value) => (value
  ? Math.max(0, Math.floor((Date.now() - toDate(value).getTime()) / 86400000))
  : 0)

export const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const duration = (seconds) => {
  const raw = Math.round(Number(seconds || 0))
  const sign = raw < 0 ? '-' : ''
  const total = Math.abs(raw)
  const h = Math.floor(total / 3600)
  const m = Math.round((total % 3600) / 60)
  return `${sign}${h ? `${h}h ` : ''}${m}m`.trim()
}

export const stopwatch = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds || 0)))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
