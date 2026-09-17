import { money } from '../lib/format.js'

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

// Cash collected per calendar month, oldest first, ending with the current month.
export function lastMonths(payments, count = 12, now = new Date()) {
  const totals = new Map()
  for (const payment of payments) {
    const key = String(payment.date).slice(0, 7)
    totals.set(key, (totals.get(key) || 0) + Number(payment.amount || 0))
  }
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + 1 + index, 1)
    return { key: monthKey(date), label: date.toLocaleDateString('en-US', { month: 'short' }), value: totals.get(monthKey(date)) || 0 }
  })
}

// Round guide lines: a step of 1, 2 or 5 times a power of ten, three to five of them.
function scale(max) {
  const rough = Math.max(max, 200) / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * power).find((value) => value >= rough)
  const top = Math.ceil(Math.max(max, 1) / step) * step
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) }
}
const axisLabel = (value) => (value >= 1000 ? `€${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : `€${value}`)

// Twelve months of collected cash with a euro scale. The current month is lit;
// hovering a bar shows its exact amount.
export default function MonthBars({ months }) {
  const { top, ticks } = scale(Math.max(...months.map((month) => month.value), 0))
  const at = (value) => `${(value / top) * 100}%`
  return <div className="bars" role="img" aria-label="Cash collected per month">
    <div className="bars-axis" aria-hidden="true">{ticks.map((tick) => <span key={tick} style={{ '--y': at(tick) }}>{axisLabel(tick)}</span>)}</div>
    <div className="bars-plot">
      <div className="bars-lines" aria-hidden="true">{ticks.map((tick) => <i key={tick} style={{ '--y': at(tick) }}/>)}</div>
      {months.map((month, index) => <div key={month.key} className={`bar-col ${index === months.length - 1 ? 'is-now' : ''}`} style={{ '--h': at(month.value), '--i': index }}>
        <div className="bar-slot"><div className="bar-fill"/><span className="bar-tip">{money(month.value)}</span></div>
      </div>)}
    </div>
    <span/>
    <div className="bars-labels">{months.map((month, index) => <span key={month.key} className={`bar-label ${index === months.length - 1 ? 'is-now' : ''}`}>{month.label}</span>)}</div>
  </div>
}
