import { Fragment, useMemo, useState } from 'react'
import Dialog from '../components/Dialog.jsx'
import Icon from '../lib/icons.jsx'
import { Avatar, clientColor, Code, Empty, Search, Segmented, Switch } from '../components/UI.jsx'
import { dayValue, duration, shortDate, toDate, today } from '../lib/format.js'
import { isOpen, pieceLabel, pieceOf, secondsThisWeek, stageColor, stageLabel, STAGES, trackedPieces, trackedSeconds } from '../lib/projects.js'

const byJobCode = (a, b) => String(b.project_id || '').localeCompare(String(a.project_id || ''), undefined, { numeric: true })
const stageTotals = (entries) => STAGES
  .map(([stage, name]) => ({ stage, name, seconds: trackedSeconds(entries.filter((entry) => entry.stage === stage)) }))
  .filter((row) => row.seconds !== 0)

// A duration as the app writes it: hours and minutes.
const splitDuration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds || 0)))
  return { hours: String(Math.floor(total / 3600)), minutes: String(Math.round((total % 3600) / 60)) }
}

// Moving a session to another day keeps its time of day, so it stays where it sat.
function startedAtFor(date, entry) {
  if (!entry) return new Date(`${date}T12:00:00`)
  const [year, month, day] = date.split('-').map(Number)
  const moved = new Date(toDate(entry.started_at))
  moved.setFullYear(year, month - 1, day)
  return moved
}

// One form for both jobs: logging time by hand, and correcting a session already
// logged — a timer left running overnight, or a stage picked wrongly.
function TimeDialog({ entry, projects, actions, onClose }) {
  const isNew = !entry
  const [form, setForm] = useState(() => ({
    project_id: entry?.project_id ?? projects[0]?.id ?? '',
    vsl_item: entry?.vsl_item || '',
    stage: entry ? (entry.stage || '') : 'rough_cut',
    date: entry ? dayValue(entry.started_at) : today(),
    note: entry?.note || '',
    ...splitDuration(isNew ? 1800 : entry.duration_seconds),
  }))
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const project = projects.find((item) => String(item.id) === String(form.project_id))
  const pieces = project ? trackedPieces(project) : [null]

  // A session timed at 1m 29s reads as "1m", so leaving that figure alone keeps its
  // exact seconds; typing a new one takes you at your word.
  const asLogged = splitDuration(entry?.duration_seconds)
  const untouched = !isNew && form.hours === asLogged.hours && form.minutes === asLogged.minutes
  const seconds = untouched
    ? Math.max(0, Math.round(Number(entry.duration_seconds || 0)))
    : Math.max(0, Math.round(Number(form.hours || 0)) * 3600 + Math.round(Number(form.minutes || 0)) * 60)

  const submit = async (event) => {
    event.preventDefault()
    if (!(seconds > 0)) { setError('Give this session a length, or delete it.'); return }
    setSaving(true)
    setError('')
    try {
      const started = startedAtFor(form.date, entry)
      const values = {
        project_id: Number(form.project_id),
        stage: form.stage || null,
        vsl_item: pieces[0] ? (form.vsl_item || pieces[0]) : null,
        started_at: started.toISOString(),
        ended_at: new Date(started.getTime() + seconds * 1000).toISOString(),
        duration_seconds: seconds,
        note: form.note || null,
      }
      if (isNew) await actions.addTime({ ...values, paused_seconds: 0, adjustment_seconds: 0 })
      else await actions.updateTime(entry.id, values)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save this time.')
      setSaving(false)
    }
  }

  return <>
    <Dialog title={isNew ? 'Add time' : 'Edit time'} onClose={onClose} footer={<>
      {!isNew && <button type="button" className="text-button text-button--danger push" onClick={() => setConfirming(true)}>Delete</button>}
      {error && <span className="form-error">{error}</span>}
      <button type="button" className="button" onClick={onClose}>Cancel</button>
      <button type="submit" form="time-form" className="button button--solid" disabled={saving || !projects.length}>{saving ? 'Saving…' : isNew ? 'Add time' : 'Save'}</button>
    </>}>
      {projects.length ? <form id="time-form" className="form-grid" onSubmit={submit}>
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
            {!form.stage && <option value="">Unstaged</option>}
            {STAGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Date</span>
          <input className="input" type="date" required value={form.date} onChange={(event) => set({ date: event.target.value })}/>
        </label>
        <label className="field">
          <span className="field-label">Hours</span>
          <input className="input input--mono" type="number" min="0" step="1" inputMode="numeric" value={form.hours} onChange={(event) => set({ hours: event.target.value })}/>
        </label>
        <label className="field">
          <span className="field-label">Minutes</span>
          <input className="input input--mono" type="number" min="0" step="1" inputMode="numeric" value={form.minutes} onChange={(event) => set({ minutes: event.target.value })}/>
        </label>
        <p className="field-hint span-2">Counts as <strong>{duration(seconds)}</strong>{!isNew && !untouched && ` · the timer said ${duration(entry.duration_seconds)}`}</p>
        <label className="field span-2">
          <span className="field-label">Note</span>
          <input className="input" placeholder="Optional" value={form.note || ''} onChange={(event) => set({ note: event.target.value })}/>
        </label>
      </form> : <p>Switch tracking on for a project first.</p>}
    </Dialog>

    {confirming && <Dialog title="Delete this time?" onClose={() => setConfirming(false)} footer={<>
      <button type="button" className="button" onClick={() => setConfirming(false)}>Keep it</button>
      <button type="button" className="button button--danger" onClick={async () => { await actions.deleteTime(entry.id); onClose() }}>Delete time</button>
    </>}><p>{duration(entry.duration_seconds)} comes off this project. This cannot be undone.</p></Dialog>}
  </>
}

// One timed session as it was logged. Clicking it opens the same form.
function EntryRow({ entry, piece, onEdit }) {
  return <button type="button" className="entry-row" onClick={() => onEdit(entry)}>
    <span className="entry-when">{shortDate(entry.started_at)}</span>
    <span className="entry-stage" style={{ '--c': stageColor(entry.stage) }}><i className="dot"/>{stageLabel(entry.stage)}</span>
    {piece && <span className="entry-piece">{pieceLabel(piece)}</span>}
    <span className="entry-note">{entry.note || ''}</span>
    <span className="entry-time">{duration(entry.duration_seconds)}</span>
    <Icon name="edit" size={13}/>
  </button>
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

function TimeRow({ project, entries, view, locked, open, onToggle, onStart, onEdit, actions }) {
  const total = trackedSeconds(entries)
  const stages = stageTotals(entries).filter((row) => row.seconds > 0)
  const tracked = Boolean(project.track_time)
  const pieces = trackedPieces(project)
  // Newest first, and never the timer still running: that one belongs to the overlay.
  const sessions = entries.filter((entry) => entry.ended_at).sort((a, b) => toDate(b.started_at) - toDate(a.started_at))
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
      {sessions.length > 0 && <div className="entry-list">
        <span className="field-label">{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} · tap one to correct it</span>
        <div className="entry-rows">
          {sessions.map((entry) => <EntryRow key={entry.id} entry={entry} piece={pieces[0] ? pieceOf(entry) : null} onEdit={onEdit}/>)}
        </div>
      </div>}
    </div>}
  </div>
}

export default function Time({ data, actions, activeTimer }) {
  const [view, setView] = useState('tracked')
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState(false)
  const [editing, setEditing] = useState(null)
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

  // Correcting a session must work even when its project is finished or no longer
  // tracked, so its own project is always one of the choices.
  const editProjects = useMemo(() => {
    const tracked = data.projects.filter((project) => project.track_time)
    if (!editing || tracked.some((project) => Number(project.id) === Number(editing.project_id))) return tracked
    return [...data.projects.filter((project) => Number(project.id) === Number(editing.project_id)), ...tracked]
  }, [data.projects, editing])

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
          onEdit={setEditing}
          actions={actions}
        />)}
      </Fragment>)}
    </div> : <Empty>{emptyText}</Empty>}

    {starting && <StartTimer project={starting} entries={entriesBy.get(Number(starting.id)) || []} actions={actions} onClose={() => setStarting(null)}/>}
    {manual && <TimeDialog projects={data.projects.filter((project) => project.track_time)} actions={actions} onClose={() => setManual(false)}/>}
    {editing && <TimeDialog entry={editing} projects={editProjects} actions={actions} onClose={() => setEditing(null)}/>}
  </section>
}
