import { useEffect, useMemo, useRef, useState } from 'react'
import { buildAnalytics, analyticsCsv } from '../lib/analytics.js'
import { dayValue, money, shortDate, dateLabel, toDate } from '../lib/format.js'
import { stageColor, serviceLabel } from '../lib/projects.js'
import { Avatar, Code, Empty, Search, Segmented, Status, Tile } from '../components/UI.jsx'
import Icon from '../lib/icons.jsx'
import Dialog from '../components/Dialog.jsx'
import ProjectDialog from '../components/ProjectDialog.jsx'
import './Analytics.css'

const hours = seconds => seconds == null ? '—' : `${(seconds / 3600).toLocaleString('en-GB', { maximumFractionDigits: 1 })}h`
const days = value => value == null ? '—' : `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })}d`
const percent = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`
const plural = (count, word) => `${count} ${count === 1 ? word : word === 'delivery' ? 'deliveries' : `${word}s`}`
const axisTop = max => {
  const step = 10 ** Math.floor(Math.log10(Math.max(max / 4, 0.25)))
  const unit = [1, 2, 5, 10].map(n => n * step).find(n => n >= max / 4) || step
  return Math.max(unit * 4, 1)
}

function Panel({ title, note, tools, children, className = '' }) {
  return <section className={`analytics-panel ${className}`}><header><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{tools}</header>{children}</section>
}

export default function Analytics({ data, actions }) {
  const [period, setPeriod] = useState('12')
  const [clientId, setClientId] = useState('all')
  const [chart, setChart] = useState('hours')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('hours')
  const [page, setPage] = useState(0)
  const [weekKey, setWeekKey] = useState(null)
  const [editing, setEditing] = useState(null)
  const weekScroll = useRef(null)
  const stats = useMemo(() => buildAnalytics(data, { period, clientId }), [data, period, clientId])
  const clients = useMemo(() => new Map(data.clients.map(client => [Number(client.id), client])), [data.clients])
  const projects = useMemo(() => new Map(data.projects.map(project => [Number(project.id), project])), [data.projects])
  useEffect(() => {
    const node = weekScroll.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [stats.weeks.length])
  const week = stats.weeks.find(item => item.key === weekKey)
  const weeks = stats.weeks.map(week => ({ ...week, deliveries: stats.rows.filter(row => row.delivered && toDate(row.project.delivered_at) >= week.start && toDate(row.project.delivered_at) < week.end).length }))
  const top = axisTop(Math.max(0, ...weeks.map(week => chart === 'hours' ? week.seconds / 3600 : week.deliveries)))
  const filtered = stats.rows.filter(row => [row.project.title, row.project.project_id, clients.get(Number(row.project.client_id))?.name, ...(row.project.services || [])].join(' ').toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    if (sort === 'title') return a.project.title.localeCompare(b.project.title)
    if (sort === 'turnaround') return (b.turnaround ?? -1) - (a.turnaround ?? -1)
    if (sort === 'lifetime') return b.lifetimeSeconds - a.lifetimeSeconds
    return b.seconds - a.seconds
  })
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1))
  const clearFilters = () => { setPeriod('12'); setClientId('all'); setPage(0); setQuery(''); setSort('hours'); setWeekKey(null) }
  const exportProjects = () => {
    const rows = [
      ['Period start', dayValue(stats.start), 'Through', dayValue(stats.now)],
      ['Client filter', clientId === 'all' ? 'All clients' : clientId === 'none' ? 'No client' : clients.get(Number(clientId))?.name],
      ['Scope', 'Projects with logged time or a delivery in this period. Lifetime hours are all saved work on each project.'],
      ['Project ID', 'Title', 'Client', 'Primary service', 'Status', 'Period hours', 'Lifetime hours', 'Period sessions', 'Delivered in period', 'Delivery date', 'Footage-to-delivery days'],
      ...filtered.map(row => [row.project.project_id, row.project.title, clients.get(Number(row.project.client_id))?.name, serviceLabel(row.project.services?.[0]), row.project.status, (row.seconds / 3600).toFixed(4), row.lifetimeSeconds > 0 ? (row.lifetimeSeconds / 3600).toFixed(4) : '', row.sessions, row.delivered ? 'Yes' : 'No', row.project.delivered_at, row.turnaround ?? '']),
    ]
    const url = URL.createObjectURL(new Blob([analyticsCsv(rows)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `ripplestudio-analytics-${dayValue(stats.start)}-${dayValue(stats.now)}.csv`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="page analytics-page">
    <header className="page-head"><div><h1 className="page-title">Analytics</h1><p className="page-sub">{dateLabel(stats.start)} – {dateLabel(stats.now)}</p></div><div className="page-actions"><button className="button" onClick={exportProjects} disabled={!filtered.length}><Icon name="download" size={15}/>Export projects</button></div></header>
    <div className="analytics-filters"><Segmented label="Period" value={period} onChange={value => { setPeriod(value); setPage(0); setWeekKey(null) }} options={['4', '12', '26', '52'].map(n => [n, `${n} weeks`]).concat([['all', 'All time']])}/><label className="analytics-client"><span className="sr-only">Client</span><select aria-label="Filter analytics by client" value={clientId} onChange={event => { setClientId(event.target.value); setPage(0); setWeekKey(null) }}><option value="all">All clients</option>{data.projects.some(project => project.client_id == null) && <option value="none">No client</option>}{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select><Icon name="chevron" size={14}/></label>{(period !== '12' || clientId !== 'all') && <button className="text-button" onClick={clearFilters}>Reset</button>}</div>

    <div className="analytics-kpis">
      <Tile value={hours(stats.seconds)} label="Hours logged" note={`${plural(stats.selected.length, 'session')} · ${plural(stats.activeDays, 'active day')}`}/>
      <Tile value={hours(stats.weeklyAverage)} label="Average week" note={`${plural(stats.completeWeeks.length, 'full week')} · includes zero weeks`}/>
      <Tile value={hours(stats.averageEffort)} label="Hours per project" note={`${stats.timedCompleted} of ${stats.delivered} delivered projects tracked`}/>
      <Tile value={days(stats.turnaround)} label="Average turnaround" note={`Footage → delivery · ${plural(stats.turnaroundCount, 'project')}`}/>
    </div>

    <div className="analytics-chart-grid">
      <Panel title="Weekly workload" note="Monday–Sunday · current week is partial" className="analytics-weekly" tools={<Segmented label="Weekly measure" value={chart} onChange={setChart} options={[[ 'hours', 'Hours' ], [ 'deliveries', 'Deliveries' ]]}/>}>
        <div className="analytics-week-scroll" ref={weekScroll}><div className="analytics-week-chart" style={{ minWidth: weeks.length > 8 ? weeks.length * 37 + 32 : 0 }}>
          <div className="analytics-y-axis" aria-hidden="true">{[top, top / 2, 0].map(value => <span key={value}>{Number(value.toFixed(1))}{chart === 'hours' ? 'h' : ''}</span>)}</div>
          <div className="analytics-week-plot">{weeks.map(week => {
            const value = chart === 'hours' ? week.seconds / 3600 : week.deliveries
            return <button key={week.key} type="button" className={`analytics-week ${week.current ? 'is-current' : ''}`} onClick={() => setWeekKey(week.key)} aria-label={`Week of ${dateLabel(week.start)}: ${chart === 'hours' ? hours(week.seconds) : plural(week.deliveries, 'delivery')}${week.current ? ', partial week' : ''}`} title={`Week of ${dateLabel(week.start)} · ${hours(week.seconds)} · ${plural(week.deliveries, 'delivery')}`}><span className="analytics-bar-value">{chart === 'hours' ? value.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : value}</span><span className="analytics-week-slot"><i style={{ height: `${value / top * 100}%` }}/></span><span className="analytics-week-label">{shortDate(week.start)}</span>{week.current && <span className="analytics-week-now">This week</span>}</button>
          })}</div>
        </div></div>
        <div className="analytics-chart-footer"><span>Last full week <strong>{hours(stats.lastWeek?.seconds)}</strong></span><span>Previous week <strong>{hours(stats.previousWeek?.seconds)}</strong></span><span>This week <strong>{hours(weeks.at(-1)?.seconds)}</strong></span></div>
      </Panel>
      <Panel title="Time by stage" note="Logged hours in this period">
        {stats.stages.length ? <div className="analytics-stage-list">{stats.stages.map(stage => <div key={stage.key} className="analytics-stage"><div><span><i style={{ background: stageColor(stage.key) }}/>{stage.label}</span><strong>{hours(stage.seconds)}<small>{percent(stage.seconds / stats.seconds)}</small></strong></div><div className="analytics-track"><i style={{ width: `${stage.seconds / stats.seconds * 100}%`, background: stageColor(stage.key) }}/></div></div>)}</div> : <Empty>No saved time in this period.</Empty>}
      </Panel>
    </div>

    <div className="analytics-secondary">
      <div><span>Delivered</span><strong>{stats.delivered}</strong></div>
      <div><span>Median project time</span><strong>{hours(stats.medianEffort)}</strong></div>
      <div><span>Median turnaround</span><strong>{days(stats.medianTurnaround)}</strong></div>
      <div><span>Average active day</span><strong>{hours(stats.averageDay)}</strong></div>
      <div><span>Average session</span><strong>{hours(stats.averageSession)}</strong></div>
      <div><span>Revision time</span><strong>{percent(stats.revisionShare)}</strong></div>
    </div>

    <div className="analytics-breakdown-grid">
      <Panel title="Project types" note="Effort and turnaround for projects delivered in this period">
        <div className="analytics-table-scroll"><table className="analytics-table analytics-types"><thead><tr><th>Type</th><th>Delivered</th><th>Avg. hours</th><th>Avg. days</th></tr></thead><tbody>{stats.types.map(type => <tr key={type.key}><td>{type.key}</td><td>{type.delivered}</td><td>{hours(type.averageEffort)}<small>{type.efforts.length} tracked</small></td><td>{days(type.turnaround)}<small>{type.turnarounds.length} dated</small></td></tr>)}</tbody></table></div>{!stats.types.length && <Empty>No projects in this period.</Empty>}
        <p className="analytics-footnote">Packages use their first listed service.</p>
      </Panel>
      <Panel title="Hours by client" note="Saved work in this period">
        {stats.clients.length ? <div className="analytics-client-list">{stats.clients.map(client => <button key={client.id} onClick={() => { setClientId(String(client.id)); setPage(0); setWeekKey(null) }} className="analytics-client-row" title={`Filter to ${clients.get(client.id)?.name || 'No client'}`}><Avatar name={clients.get(client.id)?.name} size="sm"/><span><strong>{clients.get(client.id)?.name || 'No client'}</strong><small>{plural(client.projectIds.size, 'project')}</small><span className="analytics-track"><i style={{ width: `${client.seconds / stats.seconds * 100}%` }}/></span></span><strong>{hours(client.seconds)}</strong></button>)}</div> : <Empty>No saved time in this period.</Empty>}
      </Panel>
    </div>

    <Panel title="Project detail" note="Projects worked on or delivered in this period" className="analytics-project-panel" tools={<div className="analytics-project-tools"><Search value={query} onChange={value => { setQuery(value); setPage(0) }} placeholder="Search projects or clients"/><label className="analytics-sort"><select aria-label="Sort analytics projects" value={sort} onChange={event => { setSort(event.target.value); setPage(0) }}><option value="hours">Period hours ↓</option><option value="lifetime">Lifetime hours ↓</option><option value="turnaround">Turnaround ↓</option><option value="title">Title A–Z</option></select><Icon name="chevron" size={14}/></label></div>}>
      <div className="analytics-table-scroll"><table className="analytics-table analytics-projects"><thead><tr><th>Project</th><th>Status</th><th>Period hours</th><th>Lifetime hours</th><th>Turnaround</th></tr></thead><tbody>{filtered.slice(currentPage * 10, (currentPage + 1) * 10).map(row => <tr key={row.project.id}><td><button className="analytics-project-link" onClick={() => setEditing(row.project)}><span><Code project={row.project}/><strong>{row.project.title}</strong></span><small>{clients.get(Number(row.project.client_id))?.name || 'No client'}</small></button></td><td><Status project={row.project}/></td><td>{hours(row.seconds)}<small>{plural(row.sessions, 'session')}</small></td><td>{row.lifetimeSeconds > 0 ? hours(row.lifetimeSeconds) : '—'}</td><td>{days(row.turnaround)}</td></tr>)}</tbody></table></div>
      {!filtered.length && <Empty>{query ? 'No matching projects.' : 'No work or deliveries recorded in this period.'}</Empty>}
      {filtered.length > 0 && <div className="analytics-pagination"><span>{currentPage * 10 + 1}–{Math.min((currentPage + 1) * 10, filtered.length)} of {filtered.length} projects</span><div><button className="button button--small" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="button button--small" disabled={(currentPage + 1) * 10 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>}
    </Panel>

    <Panel title="Delivery & revenue" note="Cash received in this period; rate and payment wait use delivered projects" className="analytics-financial">
      <div className="analytics-finance-metrics"><div><span>Collected</span>{stats.currencyTotals.length ? stats.currencyTotals.map(row => <strong key={row.currency}>{money(row.amount, /^[A-Z]{3}$/.test(row.currency) ? row.currency : 'EUR')}{row.currency === 'Unknown' && <small>Unknown currency</small>}</strong>) : <strong>—</strong>}</div><div><span>Effective hourly rate · EUR</span><strong>{stats.effectiveRate == null ? '—' : `${money(stats.effectiveRate)}/h`}</strong><small>{plural(stats.rateCount, 'paid, tracked project')}</small></div><div><span>Time to first cut</span><strong>{days(stats.firstCut)}</strong><small>From footage · {plural(stats.firstCutCount, 'project')}</small></div><div><span>Delivery to payment</span><strong>{days(stats.paymentWait)}</strong><small>{plural(stats.paymentWaitCount, 'dated project')}</small></div></div>
    </Panel>

    <details className="analytics-definitions"><summary>How these numbers work <Icon name="chevron" size={14}/></summary><div>
      <p><strong>Hours logged:</strong> saved sessions dated within the selected weeks, including manual entries. Sessions belong to the day they started. Running timers are excluded. Dates follow your device’s timezone.</p>
      <p><strong>Average week:</strong> total hours across complete Monday–Sunday weeks, divided by every complete week in the range, including weeks with no logs. The current week is excluded from this average.</p>
      <p><strong>Hours per project:</strong> all saved hours on tracked projects delivered in this period, including work before the period. Projects without logged time are excluded. Logged hours may be incomplete if you did not track every session.</p>
      <p><strong>Turnaround:</strong> calendar days from footage received to delivery, including weekends and client waiting time. Missing or reversed dates are excluded. A dash means there is no usable measurement; zero means a measured zero. The median is the middle project, less affected by unusually long jobs.</p>
      <p><strong>Financial context:</strong> receipts use their payment date and stay in their original currency. Effective hourly rate uses EUR receipts linked to paid, tracked projects delivered in this period, divided by those projects’ lifetime hours. Shared receipts are split by quoted price, or equally when no price is set. This is a received-revenue rate, not profit.</p>
      {stats.missingDeliveryDates > 0 && <p>{plural(stats.missingDeliveryDates, 'finished project')} in this client selection lack a delivery date and cannot enter delivery-based averages.</p>}
      {stats.ignoredEntries > 0 && <p>{plural(stats.ignoredEntries, 'saved session')} in this period have invalid dates or non-positive durations and are excluded.</p>}
    </div></details>

    {week && <Dialog title={`Week of ${dateLabel(week.start)}`} wide onClose={() => setWeekKey(null)}><div className="analytics-week-detail"><strong>{hours(week.seconds)} logged</strong><span>{plural(week.entries.length, 'session')}{week.current ? ' · current week, partial' : ''}</span></div>{week.entries.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>Date</th><th>Project</th><th>Stage</th><th>Hours</th></tr></thead><tbody>{[...week.entries].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at))).map(entry => <tr key={entry.id}><td>{shortDate(entry.started_at)}</td><td>{projects.get(Number(entry.project_id))?.title || 'Unknown project'}</td><td>{stats.stages.find(stage => stage.key === (entry.stage || 'unstaged'))?.label || 'Unstaged'}</td><td>{hours(Number(entry.duration_seconds))}</td></tr>)}</tbody></table></div> : <Empty>No saved sessions this week.</Empty>}{chart === 'deliveries' && <div className="analytics-week-deliveries"><h3>Delivered projects</h3>{stats.rows.filter(row => row.delivered && toDate(row.project.delivered_at) >= week.start && toDate(row.project.delivered_at) < week.end).map(row => <p key={row.project.id}>{row.project.project_id} · {row.project.title}</p>)}{!weeks.find(item => item.key === week.key)?.deliveries && <p>No deliveries this week.</p>}</div>}</Dialog>}
    {editing && <ProjectDialog project={editing} data={data} actions={actions} onClose={() => setEditing(null)}/>}
  </section>
}
