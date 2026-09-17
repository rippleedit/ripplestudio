import { Fragment, useMemo, useState } from 'react'
import Icon from '../lib/icons.jsx'
import ProjectDialog from '../components/ProjectDialog.jsx'
import { Footage, Payment, Price } from '../components/ProjectCells.jsx'
import { Code, Avatar, Empty, Search, Segmented, Status, Tag } from '../components/UI.jsx'
import { monthLabel, toDate, usd } from '../lib/format.js'
import { isOpen, serviceLabel, workDate } from '../lib/projects.js'

const byJobCode = (a, b) => String(b.project_id || '').localeCompare(String(a.project_id || ''), undefined, { numeric: true })
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export default function Projects({ data, actions }) {
  const [view, setView] = useState('current')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const clients = useMemo(() => new Map(data.clients.map((client) => [Number(client.id), client])), [data.clients])
  const counts = useMemo(() => {
    const open = data.projects.filter(isOpen).length
    return { current: open, closed: data.projects.length - open, all: data.projects.length }
  }, [data.projects])

  // Month, then client, then job code: the way the work is remembered.
  // Anything still open belongs to this month.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = data.projects
      .filter((project) => view === 'all' || (view === 'current' ? isOpen(project) : !isOpen(project)))
      .filter((project) => !needle || [project.project_id, project.title, clients.get(Number(project.client_id))?.name, project.status, ...(project.services || [])].join(' ').toLowerCase().includes(needle))
    const months = new Map()
    for (const project of rows) {
      const date = isOpen(project) ? new Date() : toDate(workDate(project))
      const key = monthKey(date)
      if (!months.has(key)) months.set(key, { key, label: monthLabel(date), clients: new Map(), total: 0, count: 0 })
      const month = months.get(key)
      const client = clients.get(Number(project.client_id))
      const clientKey = client?.id ?? 'none'
      if (!month.clients.has(clientKey)) month.clients.set(clientKey, { client, projects: [] })
      month.clients.get(clientKey).projects.push(project)
      month.total += Number(project.negotiated_price || 0)
      month.count += 1
    }
    return [...months.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((month) => ({
        ...month,
        clients: [...month.clients.values()]
          .sort((a, b) => String(a.client?.name ?? '~').localeCompare(String(b.client?.name ?? '~')))
          .map((group) => ({ ...group, projects: group.projects.sort(byJobCode) })),
      }))
  }, [data.projects, clients, view, query])

  return <section className="page">
    <header className="page-head">
      <div>
        <h1 className="page-title">Projects</h1>
        <p className="page-sub">{counts.current} in progress · {counts.all} in total</p>
      </div>
      <div className="page-actions"><button type="button" className="button button--solid" onClick={() => setEditing({})}><Icon name="plus" size={16}/>New project</button></div>
    </header>

    <div className="toolbar-row">
      <Segmented label="Show" value={view} onChange={setView} options={[['current', 'Current', counts.current], ['closed', 'Closed', counts.closed], ['all', 'All', counts.all]]}/>
      <Search value={query} onChange={setQuery} placeholder="Search titles, clients, IDs"/>
    </div>

    {groups.length ? <div className="ptable" role="table" aria-label="Projects">
      <div className="ptable-row ptable-head" role="row">
        <span>ID</span><span>Title</span><span className="c-type">Type</span><span>Status</span><span className="c-footage">Footage</span><span className="c-price">Price</span><span>Payment</span>
      </div>
      {groups.map((month) => <Fragment key={month.key}>
        {view !== 'current' && <div className="ptable-month">
          <strong>{month.label}</strong>
          <span>{month.count} {month.count === 1 ? 'project' : 'projects'} · {usd(month.total)}</span>
        </div>}
        {month.clients.map(({ client, projects }) => <Fragment key={client?.id ?? 'none'}>
          <div className="ptable-client"><Avatar name={client?.name} size="sm"/><strong>{client?.name || 'No client'}</strong><span>{projects.length}</span></div>
          {projects.map((project) => <button type="button" role="row" key={project.id} className={`ptable-row ptable-project ${isOpen(project) ? '' : 'is-closed'}`} onClick={() => setEditing(project)}>
            <span className="c-id"><Code project={project}/></span>
            <span className="c-title"><strong>{project.title}</strong>{Boolean(project.track_time) && <Icon name="clock" size={13} className="c-tracked"/>}</span>
            <span className="c-type">{serviceLabel(project.services?.[0])}</span>
            <span className="c-status"><Status project={project}/></span>
            <span className="c-footage"><Footage project={project}/></span>
            <span className="c-price"><Price project={project}/></span>
            <span className="c-pay"><Payment project={project}/></span>
          </button>)}
        </Fragment>)}
      </Fragment>)}
    </div> : <Empty>{query ? 'No projects match that search.' : 'Nothing here yet.'}</Empty>}

    {editing && <ProjectDialog project={editing} data={data} actions={actions} onClose={() => setEditing(null)}/>}
  </section>
}
