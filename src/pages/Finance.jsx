import { Fragment, useMemo, useState } from 'react'
import Icon from '../lib/icons.jsx'
import MonthBars, { lastMonths } from '../components/MonthBars.jsx'
import PaymentDialog, { invoiceText } from '../components/PaymentDialog.jsx'
import { Code, Avatar, Block, Empty, Search, Segmented, Tag, Tile } from '../components/UI.jsx'
import { money, monthLabel, relativeDays, shortDate, toDate, today, usd } from '../lib/format.js'
import { byLane, deliveredOn, workDate } from '../lib/projects.js'

const PERIODS = [['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['all', 'All time']]

// Calendar periods, each compared with the same stretch of the one before:
// January 1 to today against January 1 to this date last year.
function bounds(period, now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const make = (start, previous, name, previousName) => ({
    start,
    previous,
    previousEnd: new Date(Math.min(previous.getTime() + (now - start), start.getTime())),
    name,
    previousName,
  })
  if (period === 'month') return make(new Date(year, month, 1), new Date(year, month - 1, 1), 'this month', 'by this point last month')
  if (period === 'quarter') {
    const first = Math.floor(month / 3) * 3
    return make(new Date(year, first, 1), new Date(year, first - 3, 1), 'this quarter', 'by this point last quarter')
  }
  if (period === 'year') return make(new Date(year, 0, 1), new Date(year - 1, 0, 1), 'this year', 'by this point last year')
  return { start: null, previous: null, previousEnd: null, name: 'in total', previousName: '' }
}

const within = (value, start, end) => {
  if (!value) return false
  const date = toDate(value)
  return (!start || date >= start) && (!end || date < end)
}
const total = (rows, pick) => rows.reduce((sum, row) => sum + Number(pick(row) || 0), 0)
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function CopyInvoice({ text }) {
  const [done, setDone] = useState(false)
  return <button type="button" className="icon-button" title="Copy invoice info" aria-label="Copy invoice info" onClick={async (event) => {
    event.stopPropagation()
    await navigator.clipboard.writeText(text)
    setDone(true)
    setTimeout(() => setDone(false), 1600)
  }}><Icon name={done ? 'check' : 'receipt'} size={16}/></button>
}

const localDay = (value) => {
  const date = toDate(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Payments read from PayPal, waiting for you to say what they were for.
function PaypalInbox({ items, clients, actions, onMatch }) {
  const [state, setState] = useState('')
  const checkNow = async () => {
    setState('Checking PayPal…')
    try {
      const result = await actions.syncPaypal()
      setState(result?.added ? `${plural(result.added, 'new payment')} found` : 'Up to date')
    } catch (err) {
      setState(err.message || 'Could not reach PayPal.')
    }
  }
  return <Block title="From PayPal" count={items.length} tools={<><span className="field-hint">{state}</span><button type="button" className="button button--small" onClick={checkNow}>Check now</button></>}>
    {items.length ? <div className="ptable ledger-due">
      {items.map((item) => {
        const client = clients.get(Number(item.client_id))
        return <div className="ptable-row ptable-project is-static" key={item.id}>
          <span className="c-client">{client ? <><Avatar name={client.name} size="sm"/><span>{client.name}</span></> : <span>{item.payer_name || item.payer_email || 'Unknown sender'}</span>}</span>
          <span className="c-projects"><span className="paypal-from">{[client ? (item.payer_name || item.payer_email) : item.payer_email, item.note].filter(Boolean).join(' · ')}</span></span>
          <span className="c-date">{shortDate(item.happened_at)}</span>
          <span className="c-amount">{item.received_eur != null ? money(item.received_eur) : `${item.gross} ${item.currency}`}</span>
          <span className="c-action paypal-actions">
            <button type="button" className="text-button" onClick={() => actions.dismissPaypal(item.id)}>Dismiss</button>
            <button type="button" className="button button--small" onClick={() => onMatch(item)}>Match</button>
          </span>
        </div>
      })}
    </div> : <p className="block-empty">Nothing new from PayPal.</p>}
  </Block>
}

export default function Finance({ data, actions }) {
  const [period, setPeriod] = useState('year')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [matching, setMatching] = useState(null)
  const range = bounds(period)
  const clients = useMemo(() => new Map(data.clients.map((client) => [Number(client.id), client])), [data.clients])
  const projects = useMemo(() => new Map(data.projects.map((project) => [Number(project.id), project])), [data.projects])
  const covered = (payment) => (payment.project_ids || []).map((id) => projects.get(Number(id))).filter(Boolean)

  const stats = useMemo(() => {
    const { start, previous, previousEnd } = bounds(period)
    const inPeriod = (value) => (start ? within(value, start) : Boolean(value))
    const payments = data.payments.filter((payment) => inPeriod(payment.date))
    const earlier = start ? data.payments.filter((payment) => within(payment.date, previous, previousEnd)) : []

    const secondsBy = new Map()
    for (const entry of data.time_entries) {
      if (!entry.ended_at) continue
      const key = Number(entry.project_id)
      secondsBy.set(key, (secondsBy.get(key) || 0) + Number(entry.duration_seconds || 0))
    }
    // What each project actually brought in, in euros. A payment covering several
    // projects is split by their quoted prices (evenly when none has a price).
    const byId = new Map(data.projects.map((project) => [Number(project.id), project]))
    const earnedBy = new Map()
    for (const payment of data.payments) {
      const covers = (payment.project_ids || []).map((id) => byId.get(Number(id))).filter(Boolean)
      const quoted = total(covers, (project) => project.negotiated_price)
      for (const project of covers) {
        const share = quoted ? Number(project.negotiated_price || 0) / quoted : 1 / covers.length
        earnedBy.set(Number(project.id), (earnedBy.get(Number(project.id)) || 0) + Number(payment.amount || 0) * share)
      }
    }
    const earned = (project) => earnedBy.get(Number(project.id)) || 0
    // Only finished, paid work says anything true about price and hourly rate.
    const finished = data.projects.filter((project) => ['final delivery', 'payment', 'closed'].includes(project.status) && earned(project) > 0 && inPeriod(workDate(project)))
    const timed = finished.filter((project) => secondsBy.get(Number(project.id)) > 0)
    const seconds = total(timed, (project) => secondsBy.get(Number(project.id)))
    const waits = data.projects
      .filter((project) => project.paid_at && inPeriod(project.paid_at))
      .map((project) => Math.max(0, (toDate(project.paid_at) - toDate(deliveredOn(project))) / 86400000))

    const byClient = new Map()
    for (const payment of payments) {
      const key = Number(payment.client_id)
      const row = byClient.get(key) || { id: key, amount: 0, count: 0 }
      row.amount += Number(payment.amount || 0)
      row.count += 1
      byClient.set(key, row)
    }

    return {
      payments,
      collected: total(payments, (payment) => payment.amount),
      earlier: total(earlier, (payment) => payment.amount),
      averagePrice: finished.length ? total(finished, earned) / finished.length : 0,
      finishedCount: finished.length,
      rate: seconds ? total(timed, earned) / (seconds / 3600) : 0,
      hours: seconds / 3600,
      timedCount: timed.length,
      wait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
      waitCount: waits.length,
      top: [...byClient.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    }
  }, [data, period])

  const due = useMemo(() => byLane(data.projects).collect, [data.projects])
  const unpaid = total(due, ({ project }) => project.negotiated_price)
  const months = useMemo(() => lastMonths(data.payments), [data.payments])

  const needle = query.trim().toLowerCase()
  const filtered = stats.payments
    .filter((payment) => !needle || [clients.get(Number(payment.client_id))?.name, payment.notes, payment.invoice_number, ...covered(payment).flatMap((project) => [project.project_id, project.title])].join(' ').toLowerCase().includes(needle))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id))
  const groups = []
  for (const payment of filtered) {
    const key = String(payment.date).slice(0, 7)
    if (groups.at(-1)?.key !== key) groups.push({ key, label: monthLabel(toDate(payment.date)), rows: [], amount: 0 })
    groups.at(-1).rows.push(payment)
    groups.at(-1).amount += Number(payment.amount || 0)
  }

  const exportCsv = () => {
    const rows = [
      ['Date', 'Client', 'Projects', 'Invoice', 'Amount', 'Currency', 'Notes'],
      ...filtered.map((payment) => [payment.date, clients.get(Number(payment.client_id))?.name, covered(payment).map((project) => `${project.project_id} ${project.title}`).join('; '), payment.invoice_number, payment.amount, payment.currency, payment.notes]),
    ]
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }))
    link.download = `ripplestudio-payments-${period}-${today()}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const periodTitle = range.name[0].toUpperCase() + range.name.slice(1)

  return <section className="page">
    <header className="page-head">
      <div>
        <h1 className="page-title">Finance</h1>
        <p className="page-sub">{plural(stats.payments.length, 'payment')} received {range.name}</p>
      </div>
      <div className="page-actions">
        <button type="button" className="button" onClick={exportCsv} disabled={!filtered.length}><Icon name="download" size={15}/>Export CSV</button>
        <button type="button" className="button button--solid" onClick={() => setEditing({})}><Icon name="plus" size={16}/>Log payment</button>
      </div>
    </header>

    <div className="toolbar-row"><Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS}/></div>

    <div className="tiles">
      <Tile value={money(stats.collected)} label={`Collected ${range.name}`} note={range.start ? `${money(stats.earlier)} ${range.previousName}` : plural(stats.payments.length, 'payment')}/>
      <Tile value={usd(unpaid)} label="To collect" note={due.length ? `${due.length} delivered, not paid` : 'Everything is paid'} tone={unpaid ? 'is-attention' : ''}/>
      <Tile value={money(stats.averagePrice)} label="Average project" note={`Received · ${plural(stats.finishedCount, 'paid project')}`}/>
      <Tile value={`${money(stats.rate)}/h`} label="Effective rate" note={`Received ÷ ${stats.hours.toFixed(1)}h tracked · ${plural(stats.timedCount, 'project')}`}/>
      <Tile value={`${stats.wait.toFixed(1)} days`} label="Time to get paid" note={stats.waitCount ? `Delivery to payment · ${plural(stats.waitCount, 'project')}` : 'Nothing to measure yet'}/>
    </div>

    <div className="finance-row">
      <section className="panel">
        <header className="panel-head"><h3>Collected per month</h3><p>Last 12 months · EUR</p></header>
        <MonthBars months={months}/>
      </section>
      <section className="panel">
        <header className="panel-head"><h3>Top clients</h3><p>{periodTitle}</p></header>
        {stats.top.length ? <div>
          {stats.top.map((row, index) => {
            const client = clients.get(row.id)
            return <div className="rank-row" key={row.id} style={{ '--share': `${(row.amount / stats.top[0].amount) * 100}%` }}>
              <span className="rank-index">{index + 1}</span>
              <Avatar name={client?.name} size="sm"/>
              <span className="rank-name"><strong>{client?.name || 'No client'}</strong><small>{plural(row.count, 'payment')}</small></span>
              <span className="rank-amount">{money(row.amount)}</span>
            </div>
          })}
        </div> : <p className="panel-empty">No payments {range.name}.</p>}
      </section>
    </div>

    <PaypalInbox items={data.paypal || []} clients={clients} actions={actions} onMatch={setMatching}/>

    <Block title="Payments" count={filtered.length} tools={<Search value={query} onChange={setQuery} placeholder="Search clients, projects, invoices"/>}>
      {due.length > 0 && <div className="ptable ledger-due">
        <div className="ptable-month is-attention"><strong>Awaiting payment</strong><span>{plural(due.length, 'project')} · {usd(unpaid)}</span></div>
        {due.map(({ project, step }) => {
          const client = clients.get(Number(project.client_id))
          return <div className="ptable-row ptable-project is-static" key={project.id}>
            <span className="c-client"><Avatar name={client?.name} size="sm"/><span>{client?.name || 'No client'}</span></span>
            <span className="c-projects"><span className="proj"><Code project={project}/><span>{project.title}</span></span></span>
            <span className="c-date">{relativeDays(step.since)}d waiting</span>
            <span className="c-amount">{project.negotiated_price ? usd(project.negotiated_price) : ''}</span>
            <span className="c-action"><button type="button" className="button button--small" onClick={() => setEditing({ client_id: project.client_id, project_ids: [project.id] })}>Log payment</button></span>
          </div>
        })}
      </div>}

      {groups.length ? <div className="ptable ledger">
        {groups.map((group) => <Fragment key={group.key}>
          <div className="ptable-month"><strong>{group.label}</strong><span>{plural(group.rows.length, 'payment')} · {money(group.amount)}</span></div>
          {group.rows.map((payment) => {
            const client = clients.get(Number(payment.client_id))
            const linked = covered(payment)
            return <div role="button" tabIndex={0} className="ptable-row ptable-project" key={payment.id} onClick={() => setEditing(payment)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setEditing(payment) } }}>
              <span className="c-date">{shortDate(payment.date)}</span>
              <span className="c-client"><Avatar name={client?.name} size="sm"/><span>{client?.name || 'No client'}</span></span>
              <span className="c-projects">{linked.length ? linked.map((project) => <span className="proj" key={project.id}><Code project={project}/><span>{project.title}</span></span>) : <em>No projects linked</em>}</span>
              <span className="c-amount">{money(payment.amount, payment.currency)}</span>
              <span className="c-action"><CopyInvoice text={invoiceText(payment, data)}/></span>
            </div>
          })}
        </Fragment>)}
      </div> : <Empty>{query ? 'No payments match that search.' : `No payments ${range.name}.`}</Empty>}
    </Block>

    {editing && <PaymentDialog payment={editing} data={data} actions={actions} onClose={() => setEditing(null)}/>}
    {matching && <PaymentDialog
      payment={{
        client_id: matching.client_id || '',
        amount: matching.received_eur ?? '',
        date: localDay(matching.happened_at),
        notes: [`PayPal · ${matching.payer_name || matching.payer_email || 'unknown sender'}`, matching.note].filter(Boolean).join(' · '),
      }}
      data={data}
      actions={actions}
      save={(values) => actions.matchPaypal(matching, values)}
      onClose={() => setMatching(null)}
    />}
  </section>
}
