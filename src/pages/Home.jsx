import { useMemo, useState } from 'react'
import Icon from '../lib/icons.jsx'
import MonthBars, { lastMonths } from '../components/MonthBars.jsx'
import ProjectDialog from '../components/ProjectDialog.jsx'
import { Code, Avatar, Block, Pill, Tag, Tile } from '../components/UI.jsx'
import { duration, money, relativeDays, usd } from '../lib/format.js'
import { byLane, secondsThisWeek, serviceLabel } from '../lib/projects.js'

function greeting(date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function JobCard({ project, step, client, index, onOpen }) {
  const days = step.since ? relativeDays(step.since) : null
  const type = serviceLabel(project.services?.[0])
  return <button type="button" className="job-card" style={{ '--i': index }} onClick={onOpen}>
    <span className="job-title"><Code project={project}/><strong>{project.title}</strong></span>
    <span className="job-client"><Avatar name={client?.name} size="sm"/><span>{client?.name || 'No client'}</span>{type && <><i>·</i><span>{type}</span></>}</span>
    <span className="job-foot">
      <Pill tone={`s-${step.key}`}>{step.label}</Pill>
      {days != null && <span className="meta" title="Waiting"><Icon name="clock" size={13}/>{days === 0 ? 'Today' : `${days}d`}</span>}
      <span className="meta meta--end">{project.negotiated_price ? usd(project.negotiated_price) : 'No price'}</span>
    </span>
  </button>
}

function Jobs({ items, clientOf, onOpen, empty }) {
  if (!items.length) return <p className="block-empty">{empty}</p>
  return <div className="job-grid">
    {items.map(({ project, step }, index) => <JobCard key={project.id} project={project} step={step} client={clientOf(project.client_id)} index={index} onOpen={() => onOpen(project)}/>)}
  </div>
}

export default function Home({ data, actions, profile }) {
  const [editing, setEditing] = useState(null)
  const now = new Date()
  const lanes = useMemo(() => byLane(data.projects), [data.projects])
  const clientOf = useMemo(() => {
    const byId = new Map(data.clients.map((client) => [Number(client.id), client]))
    return (id) => byId.get(Number(id))
  }, [data.clients])
  const months = useMemo(() => lastMonths(data.payments), [data.payments])
  const yearTotal = useMemo(() => {
    const year = `${new Date().getFullYear()}-`
    return data.payments.reduce((sum, payment) => (String(payment.date).startsWith(year) ? sum + Number(payment.amount || 0) : sum), 0)
  }, [data.payments])
  const weekSeconds = useMemo(() => secondsThisWeek(data.time_entries), [data.time_entries])
  const unpaid = lanes.collect.reduce((sum, { project }) => sum + Number(project.negotiated_price || 0), 0)

  return <section className="page">
    <header className="page-head">
      <div>
        <h1 className="page-title">{greeting(now)}, {profile?.display_name || 'Razz'}</h1>
        <p className="page-sub">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>
      <div className="page-actions"><button type="button" className="button button--solid" onClick={() => setEditing({})}><Icon name="plus" size={16}/>New project</button></div>
    </header>

    <div className="tiles">
      <Tile value={lanes.you.length} label="With you" tone={lanes.you.length ? 'is-lead' : ''}/>
      <Tile value={lanes.client.length} label="With clients"/>
      <Tile value={usd(unpaid)} label="To collect" note={lanes.collect.length ? `${lanes.collect.length} delivered, not paid` : 'Everything is paid'} tone={unpaid ? 'is-attention' : ''}/>
      <Tile value={duration(weekSeconds)} label="Tracked this week"/>
    </div>

    <Block title="With you" count={lanes.you.length} hint="Your move, longest waiting first.">
      <Jobs items={lanes.you} clientOf={clientOf} onOpen={setEditing} empty="Nothing is waiting on you."/>
    </Block>

    {lanes.collect.length > 0 && <Block title="To collect" count={lanes.collect.length} hint="Delivered, not paid yet.">
      <Jobs items={lanes.collect} clientOf={clientOf} onOpen={setEditing}/>
    </Block>}

    <Block title="With clients" count={lanes.client.length} hint="Waiting on them.">
      <Jobs items={lanes.client} clientOf={clientOf} onOpen={setEditing} empty="Nothing is out with clients."/>
    </Block>

    <Block title="Money" hint="Cash collected per month, in euros.">
      <div className="money">
        <div className="money-figures">
          <div className="figure"><span>{now.toLocaleDateString('en-US', { month: 'long' })} so far</span><strong>{money(months[11].value)}</strong></div>
          <div className="figure"><span>Last month</span><strong>{money(months[10].value)}</strong></div>
          <div className="figure"><span>This year</span><strong>{money(yearTotal)}</strong></div>
        </div>
        <MonthBars months={months}/>
      </div>
    </Block>

    {editing && <ProjectDialog project={editing} data={data} actions={actions} onClose={() => setEditing(null)}/>}
  </section>
}
