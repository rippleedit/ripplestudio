import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAnalytics, analyticsCsv } from '../src/lib/analytics.js'

const now = new Date(2026, 10, 10, 12)
const project = (id, extra = {}) => ({ id, client_id: id, title: `Project ${id}`, status: 'closed', services: ['VSL'], payment_status: 'paid', negotiated_price: id * 100, footage_received_at: '2026-10-25', first_cut_sent_at: '2026-10-30', delivered_at: '2026-11-05', ...extra })
const entry = (id, project_id, day, hours, extra = {}) => ({ id, project_id, stage: 'rough_cut', started_at: `${day}T10:00:00`, ended_at: `${day}T18:00:00`, duration_seconds: hours * 3600, ...extra })
const data = {
  projects: [project(1), project(2), project(3, { delivered_at: null }), project(4, { status: 'editing', delivered_at: null })],
  clients: [],
  time_entries: [entry(1, 1, '2026-10-01', 4), entry(2, 1, '2026-11-03', 2), entry(3, 4, '2026-11-09', 1, { stage: null })],
  payments: [{ id: 1, client_id: 1, project_ids: [1, 2], amount: 600, currency: 'EUR', date: '2026-11-06' }],
}

test('weekly average includes zero weeks, excludes current partial week; cohort effort includes earlier work', () => {
  const s = buildAnalytics(data, { period: '4', now })
  assert.equal(s.weeks.length, 4)
  assert.equal(s.completeWeeks.length, 3)
  assert.equal(s.seconds, 3 * 3600)
  assert.equal(s.weeklyAverage, 2 * 3600 / 3)
  assert.equal(s.delivered, 2)
  assert.equal(s.timedCompleted, 1)
  assert.equal(s.averageEffort, 6 * 3600)
  assert.equal(s.turnaround, 11)
  assert.equal(s.firstCut, 5)
  assert.equal(s.missingDeliveryDates, 1)
  assert.equal(s.lastWeek.seconds, 2 * 3600)
  assert.equal(s.previousWeek.seconds, 0)
  assert.equal(s.stages.find(stage => stage.key === 'unstaged').seconds, 3600)
  assert.equal(s.stages.reduce((sum, stage) => sum + stage.seconds, 0), s.seconds)
  assert.equal(s.clients.reduce((sum, client) => sum + client.seconds, 0), s.seconds)
})

test('shared receipts retain all projects in allocation and never combine currency amounts', () => {
  const s = buildAnalytics({ ...data, payments: [...data.payments, { id: 2, client_id: 1, project_ids: [1], amount: 100, currency: 'USD', date: '2026-11-07' }] }, { period: '4', clientId: '1', now })
  assert.equal(s.seconds, 2 * 3600)
  assert.equal(s.averageEffort, 6 * 3600)
  assert.equal(s.effectiveRate, 200 / 6)
  assert.deepEqual(s.currencyTotals, [{ currency: 'EUR', amount: 600 }, { currency: 'USD', amount: 100 }])
  assert.equal(s.clients.length, 1)
  assert.equal(s.paymentWait, null) // no paid_at, no inferred payment date
})

test('unknown durations and dates, active timers and future records never enter averages', () => {
  const entries = [
    entry(10, 1, '2026-11-03', 7, { ended_at: null }),
    entry(11, 1, '2026-11-03', 7, { duration_seconds: null }),
    entry(12, 1, '2026-11-03', 7, { duration_seconds: -1 }),
    entry(13, 1, '2026-11-11', 7),
    entry(14, 1, '2026-11-03', 7, { ended_at: 'invalid' }),
    entry(15, 1, '2026-11-03', 7, { ended_at: '2026-11-02T10:00:00' }),
    entry(16, 9999, '2026-11-03', 7),
  ]
  const s = buildAnalytics({ ...data, time_entries: entries }, { period: '4', now })
  assert.equal(s.seconds, 0)
  assert.equal(s.averageEffort, null)
  assert.equal(s.averageSession, null)
  assert.equal(s.revisionShare, null)
  assert.equal(s.weeklyAverage, 0)
  assert.equal(s.effectiveRate, null)
})

test('turnaround uses calendar dates across DST and excludes reversed or absent dates', () => {
  const s = buildAnalytics({ projects: [project(1, { footage_received_at: '2026-10-24', delivered_at: '2026-10-26' }), project(2, { footage_received_at: '2026-11-06', delivered_at: '2026-11-05' }), project(3, { footage_received_at: null })], time_entries: [], payments: [] }, { period: '4', now })
  assert.equal(s.turnaround, 2)
  assert.equal(s.turnaroundCount, 1)
  assert.equal(s.delivered, 3)
  assert.equal(s.medianTurnaround, 2)
})

test('empty/all-time selection has unknown averages and a real zero for logged time', () => {
  const s = buildAnalytics({ projects: [], payments: [], time_entries: [] }, { period: 'all', now })
  assert.equal(s.weeks.length, 1)
  assert.equal(s.seconds, 0)
  assert.equal(s.weeklyAverage, null)
  assert.equal(s.averageEffort, null)
  assert.equal(s.turnaround, null)
  assert.equal(s.effectiveRate, null)
})

test('multi-service projects are counted once and medians resist long outliers', () => {
  const s = buildAnalytics({ projects: [project(1, { services: ['VSL', 'Thumbnail'] }), project(2), project(3)], time_entries: [entry(1, 1, '2026-11-03', 1), entry(2, 2, '2026-11-03', 3), entry(3, 3, '2026-11-03', 20)], payments: [] }, { period: '4', now })
  assert.equal(s.averageEffort, 8 * 3600)
  assert.equal(s.medianEffort, 3 * 3600)
  assert.equal(s.types.length, 1)
  assert.equal(s.types[0].delivered, 3)
})

test('CSV escapes quotes, line breaks and spreadsheet formulas', () => {
  const text = analyticsCsv([['=WEBSERVICE("bad")', 'a,b', 'line\nbreak', 3]])
  assert.ok(text.includes('"\'=WEBSERVICE(""bad"")"'))
  assert.ok(text.includes('"a,b"'))
  assert.ok(text.includes('"line\nbreak"'))
})


test('unassigned projects can be inspected without a fabricated client ID', () => {
  const s = buildAnalytics({ projects: [project(1, { client_id: null })], payments: [], time_entries: [entry(1, 1, '2026-11-03', 2)] }, { period: '4', clientId: 'none', now })
  assert.equal(s.seconds, 2 * 3600)
  assert.equal(s.clients[0].id, 'none')
  assert.equal(s.rows.length, 1)
})
