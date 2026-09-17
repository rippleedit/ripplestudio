import { Fragment, useMemo, useState } from 'react'
import Dialog from '../components/Dialog.jsx'
import Icon from '../lib/icons.jsx'
import { Avatar, clientColor, Code, Empty, Search, Segmented, Switch } from '../components/UI.jsx'
import { duration, today } from '../lib/format.js'
import { isOpen, pieceLabel, pieceOf, secondsThisWeek, stageColor, STAGES, trackedPieces, trackedSeconds } from '../lib/projects.js'

const byJobCode = (a, b) => String(b.project_id || '').localeCompare(String(a.project_id || ''), undefined, { numeric: true })
const stageTotals = (entries) => STAGES
  .map(([stage, name]) => ({ stage, name, seconds: trackedSeconds(entries.filter((entry) => entry.stage === stage)) }))
  .filter((row) => row.seconds !== 0)

function ManualTime({ projects, onClose, onSave }) {
  const [form, setForm] = useState({ project_id: projects[0]?.id ?? '', vsl_item: '', stage: 'rough_cut', date: today(), minutes: '30', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const project = projects.find((item) => String(item.id) === String(form.project_id))
  const pieces = project ? trackedPieces(project) : [null]

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const seconds = Math.round(Number(form.minutes) * 60)
      const started = new Date(`${form.date}T12:00:00`)
      await onSave({
        project_id: Number(form.project_id),
        stage: form.stage,
        vsl_item: pieces[0] ? (form.vsl_item || pieces[0]) : null,
        started_at: started.toISOString(),
        ended_at: new Date(started.getTime() + Math.max(0, seconds) * 1000).toISOString(),
        duration_seconds: seconds,
        note: form.note || null,
        paused_seconds: 0,
        adjustment_seconds: 0,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add this time.')
      setSaving(false)
    }
  }

  return <Dialog title="Add time" onClose={onClose} footer={<>
    {error && <span className="form-error">{error}</span>}
    <button type="button" className="button" onClick={onClose}>Cancel</button>
    <button type="submit" form="manual-time" className="button button--solid" disabled={saving || !projects.length}>{saving ? 'Adding…' : 'Add time'}</button>
  </>}>
    {projects.length ? <form id="manual-time" className="form-grid" onSubmit={submit}>
      <label className="field span-2">
        <span className="field-label">Project</span>
        <select className="select" required value={form.project_id} onChange={(event) => set({ project_id: event.target.value, vsl_item: '' })}>
          {projects.map((item) => <option key={item.id} value={item.id}>{item.project_id ? `${item.project_id} · ` : ''}{item.title}</option>)}
        </select>
      </label>
      {pieces[0] && <label className="field span-2">
        <span className="field-label">Piece</span>
        <select className="select" value={form.vsl_item || pieces[0]} onChange={(event) => set({ vsl_item: event.target.value })}>
          {pieces.map((key) => <option key={key} value={key}>{pieceLabel(key)}</option>)}
        </select>
      </label>}
      <label className="field">
        <span className="field-label">Stage</span>
        <select className="select" value={form.stage} onChange={(event) => set({ stage: event.target.value })}>
          {STAGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Minutes</span>
        <input className="input input--mono" type="number" step="1" inputMode="numeric" required value={form.minutes} onChange={(event) => set({ minutes: event.target.value })}/>
      </label>
      <label className="field">
        <span className="field-label">Date</span>
        <input className="input" type="date" required value={form.date} onChange={(event) => set({ date: event.target.value })}/>
      </label>
      <label className="field span-2">
        <span className="field-label">Note</span>
        <input className="input" placeholder="Optional" value={form.note} onChange={(event) => set({ note: event.target.value })}/>
      </label>
    </form> : <p>Switch tracking on for a project first.</p>}
  </Dialog>
}

// Pick what you are about to work on; the timer takes over the screen from there.
function StartTimer({ project, entries, actions, onClose }) {
  const pieces = trackedPieces(project)
  const [piece, setPiece] = useState(pieces[0])
  const own = piece ? entries.filter((entry) => pieceOf(entry) === piece) : entries
  return <Dialog title={<><Code project={project}/><span className="dialog-title-text">{project.title}</span></>} onClose={onClose}>
    {piece && <Segmented label="Piece" value={piece} onChange={setPiece} options={pieces.map((key) => [key, pieceLabel(key)])}/>}
    <div className="stage-cells">
      {STAGES.map(([stage, name]) => {
        const seconds = trackedSeconds(own.filter((entry) => entry.stage === stage))
        return <button type="button" key={stage} className={`stage-cell ${seconds ? 'has-time' : ''}`} onClick={async () => { onClose(); await actions.startTimer(project.id, stage, piece) }}>
          <span className="stage-name" style={{ '--c': stageColor(stage) }}><Icon name="stopwatch" size={13}/>{name}</span>
          <span className="stage-time">{duration(seconds)}</span>
        </button>
      })}
    </div>
  </Dialog>
}

function TimeRow({ project, entries, view, locked, open, onToggle, onStart, actions }) {
  const total = trackedSeconds(entries)
  const stages = stageTotals(entries).filter((row) => row.seconds > 0)
  const tracked = Boolean(project.track_time)
  const pieces = trackedPieces(project)
  return <div className={`time-row ${open ? 'is-open' : ''} ${tracked ? '' : 'is-off'}`}>
    <div className="time-row-main" role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() } }}>
      <span className="c-id"><Code project={project}/></span>
      <span className="c-title"><strong>{project.title}</strong></span>
      <span className="time-bar" aria-hidden="true">
        {stages.map((row, index) => <i key={row.stage} title={`${row.name} · ${duration(row.seconds)}`} style={{ flexGrow: row.seconds, '--tint': stageColor(row.stage) }}/>)}
      </span>
      <span className="time-total">{duration(total)}</span>
      <span className="c-action" onClick={(event) => event.stopPropagation()}>
        {view === 'open'
          ? <Switch on={tracked} disabled={locked} label={`Track time for ${project.title}`} onChange={(track_time) => actions.updateProject(project.id, { track_time })}/>
          : isOpen(project) && <button type="button" className="button button--small" disabled={locked} onClick={() => onStart(project)}><Icon name="stopwatch" size={13}/>Start</button>}
      </span>
    </div>
    {open && <div className="time-detail">
      {pieces.map((piece) => {
        const rows = stageTotals(piece ? entries.filter((entry) => pieceOf(entry) === piece) : entries)
        return <div className="time-detail-line" key={piece || 'project'}>
          {piece && <span className="field-label">{pieceLabel(piece)}</span>}
          {rows.length ? rows.map((row) => <span className="stage-chip" key={row.stage} style={{ '--c': stageColor(row.stage) }}><i className="dot"/><span>{row.name}</span><strong>{duration(row.seconds)}</strong></span>) : <em>Nothing logged yet.</em>}
        </div>
      })}
    </div>}
  </div>
}

export default function Time({ data, actions, activeTimer }) {
  const [view, setView] = useState('tracked')
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState(false)
  const [starting, setStarting] = useState(null)
  const [openId, setOpenId] = useState(null)
  const locked = Boolean(activeTimer)

  const entriesBy = useMemo(() => {
    const map = new Map()
    for (const entry of data.time_entries) {
      const key = Number(entry.project_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    }
    return map
  }, [data.time_entries])
  const weekSeconds = useMemo(() => secondsThisWeek(data.time_entries), [data.time_entries])

  const matches = useMemo(() => ({
    tracked: (project) => isOpen(project) && Boolean(project.track_time),
    open: (project) => isOpen(project),
    finished: (project) => !isOpen(project) && entriesBy.has(Number(project.id)),
  }), [entriesBy])
  const counts = Object.fromEntries(Object.entries(matches).map(([key, match]) => [key, data.projects.filter(match).length]))

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const clients = new Map(data.clients.map((client) => [Number(client.id), client]))
    const byClient = new Map()
    for (const project of data.projects.filter(matches[view])) {
      const client = clients.get(Number(project.client_id))
      if (needle && ![project.project_id, project.title, client?.name].join(' ').toLowerCase().includes(needle)) continue
      const key = client?.id ?? 'none'
      if (!byClient.has(key)) byClient.set(key, { client, projects: [] })
      byClient.get(key).projects.push(project)
    }
    return [...byClient.values()]
      .sort((a, b) => String(a.client?.name ?? '~').localeCompare(String(b.client?.name ?? '~')))
      .map((group) => ({ ...group, projects: group.projects.sort(byJobCode) }))
  }, [data.projects, data.clients, matches, view, query])

  const emptyText = query ? 'No projects match that search.'
    : view === 'tracked' ? 'No projects are being tracked. Switch one on under All open.'
      : 'Nothing here yet.'

  return <section className="page">
    <header className="page-head">
      <div>
        <h1 className="page-title">Time</h1>
        <p className="page-sub">{duration(weekSeconds)} tracked this week</p>
      </div>
      <div className="page-actions"><button type="button" className="button button--solid" onClick={() => setManual(true)}><Icon name="plus" size={16}/>Add time</button></div>
    </header>

    <div className="toolbar-row">
      <Segmented label="Show" value={view} onChange={setView} options={[['tracked', 'Tracked', counts.tracked], ['open', 'All open', counts.open], ['finished', 'Finished', counts.finished]]}/>
      <Search value={query} onChange={setQuery} placeholder="Search projects or clients"/>
    </div>
    {view !== 'open' && <div className="stage-legend" aria-label="Stage colours">
      {STAGES.map(([stage, name]) => <span key={stage} style={{ '--c': stageColor(stage) }}><i className="dot"/>{name}</span>)}
    </div>}

    {groups.length ? <div className="ptable">
      {groups.map(({ client, projects }) => <Fragment key={client?.id ?? 'none'}>
        <div className="ptable-client"><Avatar name={client?.name} size="sm"/><strong>{client?.name || 'No client'}</strong><span>{projects.length}</span></div>
        {projects.map((project) => <TimeRow
          key={project.id}
          project={project}
          entries={entriesBy.get(Number(project.id)) || []}
          view={view}
          locked={locked}
          open={openId === project.id}
          onToggle={() => setOpenId(openId === project.id ? null : project.id)}
          onStart={setStarting}
          actions={actions}
        />)}
      </Fragment>)}
    </div> : <Empty>{emptyText}</Empty>}

    {starting && <StartTimer project={starting} entries={entriesBy.get(Number(starting.id)) || []} actions={actions} onClose={() => setStarting(null)}/>}
    {manual && <ManualTime projects={data.projects.filter((project) => project.track_time)} onClose={() => setManual(false)} onSave={actions.addTime}/>}
  </section>
}
