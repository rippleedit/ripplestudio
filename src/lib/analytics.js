import { dayValue, toDate } from './format.js'
import { serviceLabel, stageLabel } from './projects.js'

const DAY = 86400000
const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0)
const mean = values => values.length ? sum(values, value => value) / values.length : null
const median = values => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const validDate = value => {
  if (!value) return null
  const date = toDate(value)
  return Number.isFinite(date.getTime()) ? date : null
}
export function mondayOf(value) {
  const date = toDate(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7)
}
const addDays = (date, count) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count)
const calendarDays = (from, until) => {
  const a = validDate(from), b = validDate(until)
  if (!a || !b) return null
  const days = (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY
  return days >= 0 ? days : null
}
const finished = project => ['final delivery', 'payment', 'closed'].includes(project.status)

// Read-only calculations over the same owner-scoped records used by the app.
// Work is assigned to a session's start date (including manual entries), using
// saved duration_seconds rather than wall time. Running timers are excluded.
export function buildAnalytics(data, { period = '12', clientId = 'all', now = new Date() } = {}) {
  const matchesClient = row => clientId === 'all' || (clientId === 'none' ? row.client_id == null : String(row.client_id) === String(clientId))
  const projects = data.projects.filter(matchesClient)
  const byId = new Map(projects.map(project => [Number(project.id), project]))
  const entries = data.time_entries.filter(entry => {
    const started = validDate(entry.started_at), ended = validDate(entry.ended_at)
    return byId.has(Number(entry.project_id)) && started && ended && started <= now && ended <= now && ended >= started && Number.isFinite(Number(entry.duration_seconds)) && Number(entry.duration_seconds) > 0
  })
  const payments = data.payments.filter(payment => matchesClient(payment) && validDate(payment.date) && toDate(payment.date) <= now && Number.isFinite(Number(payment.amount)))
  const currentWeek = mondayOf(now)
  const oldest = [...entries.map(e => toDate(e.started_at)), ...projects.flatMap(p => validDate(p.delivered_at) && toDate(p.delivered_at) <= now ? [toDate(p.delivered_at)] : []), ...payments.map(p => toDate(p.date))].sort((a, b) => a - b)[0]
  const start = period === 'all' ? mondayOf(oldest || now) : addDays(currentWeek, -(Number(period) - 1) * 7)
  const inPeriod = value => {
    const date = validDate(value)
    return Boolean(date && date >= start && date <= now)
  }
  const selected = entries.filter(entry => inPeriod(entry.started_at))
  const weeks = []
  for (let date = start; date <= currentWeek; date = addDays(date, 7)) {
    weeks.push({ key: dayValue(date), start: date, end: addDays(date, 7), seconds: 0, entries: [], current: date.getTime() === currentWeek.getTime() })
  }
  const weekMap = new Map(weeks.map(week => [week.key, week]))
  const stages = new Map(), daily = new Map(), periodSeconds = new Map(), lifetimeSeconds = new Map()
  for (const entry of entries) {
    const id = Number(entry.project_id)
    lifetimeSeconds.set(id, (lifetimeSeconds.get(id) || 0) + Number(entry.duration_seconds))
  }
  for (const entry of selected) {
    const seconds = Number(entry.duration_seconds), id = Number(entry.project_id)
    const week = weekMap.get(dayValue(mondayOf(entry.started_at)))
    week.seconds += seconds
    week.entries.push(entry)
    const day = dayValue(toDate(entry.started_at))
    daily.set(day, (daily.get(day) || 0) + seconds)
    periodSeconds.set(id, (periodSeconds.get(id) || 0) + seconds)
    const key = entry.stage || 'unstaged'
    const stage = stages.get(key) || { key, label: stageLabel(entry.stage), seconds: 0, sessions: 0 }
    stage.seconds += seconds; stage.sessions += 1; stages.set(key, stage)
  }
  // Delivery cohorts require the real delivery date; payment or creation dates
  // are never substituted. Project effort uses ALL saved sessions for that cohort.
  const delivered = projects.filter(project => finished(project) && inPeriod(project.delivered_at))
  const deliveryIds = new Set(delivered.map(project => Number(project.id)))
  const rows = projects.filter(project => periodSeconds.has(Number(project.id)) || deliveryIds.has(Number(project.id))).map(project => ({
    project,
    seconds: periodSeconds.get(Number(project.id)) || 0,
    lifetimeSeconds: lifetimeSeconds.get(Number(project.id)) || 0,
    sessions: selected.filter(entry => Number(entry.project_id) === Number(project.id)).length,
    delivered: deliveryIds.has(Number(project.id)),
    turnaround: calendarDays(project.footage_received_at, project.delivered_at),
    firstCut: calendarDays(project.footage_received_at, project.first_cut_sent_at),
  }))
  const completedRows = rows.filter(row => row.delivered)
  const timedCompleted = completedRows.filter(row => row.lifetimeSeconds > 0)
  const turnarounds = completedRows.map(row => row.turnaround).filter(value => value !== null)
  const firstCuts = completedRows.filter(row => row.firstCut !== null && row.firstCut <= (row.turnaround ?? Infinity)).map(row => row.firstCut)
  const seconds = sum(selected, entry => Number(entry.duration_seconds))
  const completeWeeks = weeks.filter(week => !week.current)
  const types = new Map(), clients = new Map()
  for (const row of rows) {
    // A multi-service package counts once, under its first listed service.
    const type = serviceLabel(row.project.services?.[0]) || 'Unspecified'
    const item = types.get(type) || { key: type, delivered: 0, efforts: [], turnarounds: [], seconds: 0 }
    item.seconds += row.seconds
    if (row.delivered) {
      item.delivered += 1
      if (row.lifetimeSeconds > 0) item.efforts.push(row.lifetimeSeconds)
      if (row.turnaround !== null) item.turnarounds.push(row.turnaround)
    }
    types.set(type, item)
    const id = row.project.client_id == null ? 'none' : Number(row.project.client_id)
    const client = clients.get(id) || { id, seconds: 0, projectIds: new Set(), delivered: 0 }
    client.seconds += row.seconds
    if (row.seconds > 0) client.projectIds.add(row.project.id)
    if (row.delivered) client.delivered += 1
    clients.set(id, client)
  }
  const earned = new Map()
  // Split linked EUR receipts by quote, or evenly if no quote exists. All
  // linked projects remain in the denominator, even with a client filter.
  const allProjects = new Map(data.projects.map(project => [Number(project.id), project]))
  for (const payment of data.payments) {
    if (payment.currency !== 'EUR' || !validDate(payment.date) || toDate(payment.date) > now || !Number.isFinite(Number(payment.amount))) continue
    const covers = [...new Set((payment.project_ids || []).map(Number))].map(id => allProjects.get(id)).filter(Boolean)
    const quoted = sum(covers, project => Math.max(0, Number(project.negotiated_price) || 0))
    for (const project of covers) {
      const share = quoted ? Math.max(0, Number(project.negotiated_price) || 0) / quoted : 1 / covers.length
      earned.set(Number(project.id), (earned.get(Number(project.id)) || 0) + Number(payment.amount) * share)
    }
  }
  const rateRows = timedCompleted.filter(row => row.project.payment_status === 'paid' && (earned.get(Number(row.project.id)) || 0) > 0)
  const rateSeconds = sum(rateRows, row => row.lifetimeSeconds)
  const currencyTotals = new Map()
  for (const payment of payments.filter(payment => inPeriod(payment.date))) {
    const currency = payment.currency || 'Unknown'
    currencyTotals.set(currency, (currencyTotals.get(currency) || 0) + Number(payment.amount))
  }
  const waitDays = delivered.filter(project => project.paid_at && toDate(project.paid_at) <= now).map(project => calendarDays(project.delivered_at, project.paid_at)).filter(value => value !== null)
  return {
    start, now, selected, weeks, completeWeeks, rows, seconds, daily,
    weeklyAverage: completeWeeks.length ? sum(completeWeeks, week => week.seconds) / completeWeeks.length : null,
    lastWeek: completeWeeks.at(-1) || null, previousWeek: completeWeeks.at(-2) || null,
    averageEffort: mean(timedCompleted.map(row => row.lifetimeSeconds)), medianEffort: median(timedCompleted.map(row => row.lifetimeSeconds)), timedCompleted: timedCompleted.length,
    delivered: delivered.length, turnaround: mean(turnarounds), medianTurnaround: median(turnarounds), turnaroundCount: turnarounds.length,
    firstCut: mean(firstCuts), firstCutCount: firstCuts.length,
    activeDays: daily.size, averageDay: daily.size ? seconds / daily.size : null,
    averageSession: selected.length ? seconds / selected.length : null,
    revisionShare: seconds ? (stages.get('revisions')?.seconds || 0) / seconds : null,
    stages: [...stages.values()].sort((a, b) => b.seconds - a.seconds),
    clients: [...clients.values()].filter(client => client.seconds > 0).sort((a, b) => b.seconds - a.seconds),
    types: [...types.values()].map(type => ({ ...type, averageEffort: mean(type.efforts), turnaround: mean(type.turnarounds) })).sort((a, b) => b.seconds - a.seconds),
    currencyTotals: [...currencyTotals].map(([currency, amount]) => ({ currency, amount })),
    effectiveRate: rateSeconds ? sum(rateRows, row => earned.get(Number(row.project.id))) / (rateSeconds / 3600) : null,
    rateCount: rateRows.length, paymentWait: mean(waitDays), paymentWaitCount: waitDays.length,
    missingDeliveryDates: projects.filter(project => finished(project) && !validDate(project.delivered_at)).length,
    ignoredEntries: data.time_entries.filter(entry => byId.has(Number(entry.project_id)) && inPeriod(entry.started_at) && entry.ended_at && !entries.includes(entry)).length,
  }
}

export function analyticsCsv(rows) {
  const cell = value => {
    let text = String(value ?? '')
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}
