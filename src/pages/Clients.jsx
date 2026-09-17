import { useEffect, useMemo, useState } from 'react'
import Dialog from '../components/Dialog.jsx'
import PaymentDialog from '../components/PaymentDialog.jsx'
import PictureField from '../components/PictureField.jsx'
import ProjectDialog from '../components/ProjectDialog.jsx'
import { Payment, Price } from '../components/ProjectCells.jsx'
import Icon from '../lib/icons.jsx'
import { Code, Avatar, Empty, Search, Status, Tag, Tile } from '../components/UI.jsx'
import { dateLabel, money, usd } from '../lib/format.js'
import { isOpen, isUnpaid, suggestProjectId } from '../lib/projects.js'

function ClientDialog({ client, actions, onClose, onSaved, onDeleted }) {
  const isNew = !client?.id
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '', ...client })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const values = { name: form.name.trim(), email: form.email || null, phone: form.phone || null, notes: form.notes || null }
      if (isNew) onSaved(await actions.createClient(values))
      else { await actions.updateClient(client.id, values); onSaved(client) }
    } catch (err) {
      setError(err.message || 'Could not save this client.')
      setSaving(false)
    }
  }

  return <>
    <Dialog title={isNew ? 'New client' : `Edit ${client.name}`} onClose={onClose} footer={<>
      {!isNew && <button type="button" className="text-button text-button--danger push" onClick={() => setConfirming(true)}>Delete</button>}
      {error && <span className="form-error">{error}</span>}
      <button type="button" className="button" onClick={onClose}>Cancel</button>
      <button type="submit" form="client-form" className="button button--solid" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Add client' : 'Save'}</button>
    </>}>
      <form id="client-form" className="form-grid" onSubmit={submit}>
        {!isNew && <PictureField client={client} actions={actions}/>}
        <label className="field span-2"><span className="field-label">Name</span><input className="input" required autoFocus value={form.name} onChange={(event) => set({ name: event.target.value })}/></label>
        <label className="field"><span className="field-label">Email</span><input className="input" type="email" value={form.email || ''} onChange={(event) => set({ email: event.target.value })}/></label>
        <label className="field"><span className="field-label">Phone</span><input className="input" type="tel" value={form.phone || ''} onChange={(event) => set({ phone: event.target.value })}/></label>
        <label className="field span-2"><span className="field-label">Notes</span><textarea className="textarea" rows="4" value={form.notes || ''} onChange={(event) => set({ notes: event.target.value })}/></label>
      </form>
    </Dialog>
    {confirming && <Dialog title={`Delete ${client.name}?`} onClose={() => setConfirming(false)} footer={<>
      <button type="button" className="button" onClick={() => setConfirming(false)}>Keep</button>
      <button type="button" className="button button--danger" onClick={async () => { await actions.deleteClient(client.id); onDeleted() }}>Delete client</button>
    </>}><p>Their projects, payments and tracked time are removed too. This cannot be undone.</p></Dialog>}
  </>
}

// Notes save themselves when you click away.
function Notes({ client, actions }) {
  const [value, setValue] = useState(client.notes || '')
  const [state, setState] = useState('')
  useEffect(() => {
    if (state !== 'saved') return undefined
    const timeout = setTimeout(() => setState(''), 1800)
    return () => clearTimeout(timeout)
  }, [state])
  const save = async () => {
    if ((client.notes || '') === value) return
    setState('saving')
    try { await actions.updateClient(client.id, { notes: value || null }); setState('saved') }
    catch { setState('error') }
  }
  const label = { saving: 'Saving…', saved: 'Saved', error: 'Not saved' }[state] || ''
  return <label className="field">
    <span className="field-row"><span className="field-label">Notes</span><span className={`save-state ${state}`}>{label}</span></span>
    <textarea className="textarea" rows="4" placeholder="How you met, what they like, what to remember." value={value} onChange={(event) => setValue(event.target.value)} onBlur={save}/>
  </label>
}

function ClientDetail({ client, projects, payments, live, unpaid, collected, data, actions, open }) {
  const byId = new Map(data.projects.map((project) => [Number(project.id), project]))
  const unpaidTotal = unpaid.reduce((sum, project) => sum + Number(project.negotiated_price || 0), 0)
  const sortedProjects = [...projects].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || String(b.project_id || '').localeCompare(String(a.project_id || ''), undefined, { numeric: true }))
  const sortedPayments = [...payments].sort((a, b) => String(b.date).localeCompare(String(a.date)))

  return <article className="client-detail" id="client-detail">
    <header className="client-head">
      <Avatar name={client.name} size="lg"/>
      <div><h2>{client.name}</h2><p className="page-sub">Client since {dateLabel(client.created_at)}</p></div>
      <div className="client-actions">
        <button type="button" className="button" onClick={() => open({ type: 'client', value: client })}><Icon name="edit" size={15}/>Edit</button>
        <button type="button" className="button" onClick={() => open({ type: 'payment', value: { client_id: client.id } })}>Log payment</button>
        <button type="button" className="button button--solid" onClick={() => open({ type: 'project', value: { client_id: client.id, project_id: suggestProjectId(data.projects, client.id, client.name) } })}><Icon name="plus" size={16}/>New project</button>
      </div>
    </header>

    <div className="tiles">
      <Tile value={money(collected)} label="Collected"/>
      <Tile value={projects.length} label="Projects"/>
      <Tile value={live} label="Live now"/>
      <Tile value={usd(unpaidTotal)} label="Unpaid" tone={unpaidTotal ? 'is-attention' : ''}/>
    </div>

    <div className="client-contact">
      <div className="contact-lines">
        <div className="contact-line"><span className="field-label">Email</span>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : <em>Not added</em>}</div>
        <div className="contact-line"><span className="field-label">Phone</span>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : <em>Not added</em>}</div>
      </div>
      <Notes key={client.id} client={client} actions={actions}/>
    </div>

    <section>
      <div className="sub-head"><h3>Projects</h3><span className="count">{projects.length}</span></div>
      {projects.length ? <div className="ptable ptable--compact">
        {sortedProjects.map((project) => <button type="button" key={project.id} className={`ptable-row ptable-project ${isOpen(project) ? '' : 'is-closed'}`} onClick={() => open({ type: 'project', value: project })}>
          <span className="c-id"><Code project={project}/></span>
          <span className="c-title"><strong>{project.title}</strong></span>
          <span className="c-status"><Status project={project}/></span>
          <span className="c-price"><Price project={project}/></span>
          <span className="c-pay"><Payment project={project}/></span>
        </button>)}
      </div> : <p className="block-empty">No projects yet.</p>}
    </section>

    <section>
      <div className="sub-head"><h3>Payments</h3><span className="count">{payments.length}</span></div>
      {payments.length ? <div className="ptable ptable--payments">
        {sortedPayments.map((payment) => {
          const covered = (payment.project_ids || []).map((id) => byId.get(Number(id))).filter(Boolean)
          return <button type="button" key={payment.id} className="ptable-row ptable-project" onClick={() => open({ type: 'payment', value: payment })}>
            <span className="c-date">{dateLabel(payment.date)}</span>
            <span className="c-projects">{covered.length ? covered.map((project) => <span className="proj" key={project.id}><Code project={project}/><span>{project.title}</span></span>) : <em>No projects linked</em>}</span>
            <span className="c-amount">{money(payment.amount, payment.currency)}</span>
          </button>
        })}
      </div> : <p className="block-empty">No payments yet.</p>}
    </section>
  </article>
}

export default function Clients({ data, actions }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [dialog, setDialog] = useState(null)

  const summaries = useMemo(() => data.clients.map((client) => {
    const projects = data.projects.filter((project) => Number(project.client_id) === Number(client.id))
    const payments = data.payments.filter((payment) => Number(payment.client_id) === Number(client.id))
    return {
      client,
      projects,
      payments,
      live: projects.filter(isOpen).length,
      unpaid: projects.filter(isUnpaid),
      collected: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    }
  }).sort((a, b) => a.client.name.localeCompare(b.client.name)), [data])

  const needle = query.trim().toLowerCase()
  const rows = summaries.filter(({ client }) => !needle || [client.name, client.email, client.phone, client.notes].join(' ').toLowerCase().includes(needle))
  const current = rows.find((row) => Number(row.client.id) === Number(selectedId)) || rows[0]
  const withLiveWork = summaries.filter((row) => row.live).length

  const choose = (id) => {
    setSelectedId(id)
    if (window.matchMedia('(max-width: 1180px)').matches) {
      requestAnimationFrame(() => document.getElementById('client-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  return <section className="page">
    <header className="page-head">
      <div>
        <h1 className="page-title">Clients</h1>
        <p className="page-sub">{data.clients.length} {data.clients.length === 1 ? 'client' : 'clients'} · {withLiveWork} with live work</p>
      </div>
      <div className="page-actions"><button type="button" className="button button--solid" onClick={() => setDialog({ type: 'client', value: {} })}><Icon name="plus" size={16}/>New client</button></div>
    </header>

    {data.clients.length ? <div className="clients-layout">
      <aside className="client-list">
        <Search value={query} onChange={setQuery} placeholder="Search clients"/>
        {rows.length ? <div className="client-rows">
          {rows.map(({ client, projects, live, unpaid, collected }) => <button type="button" key={client.id} className={`client-row ${Number(current?.client.id) === Number(client.id) ? 'is-active' : ''}`} onClick={() => choose(client.id)}>
            <Avatar name={client.name}/>
            <span className="client-row-name">
              <strong>{client.name}</strong>
              <small>{live ? `${live} live · ` : ''}{projects.length} {projects.length === 1 ? 'project' : 'projects'}</small>
            </span>
            <span className="client-row-value">{unpaid.length > 0 && <i className="dot attention" title="Delivered work not paid"/>}{money(collected)}</span>
          </button>)}
        </div> : <Empty>No client matches that search.</Empty>}
      </aside>
      {current && <ClientDetail key={current.client.id} {...current} data={data} actions={actions} open={setDialog}/>}
    </div> : <Empty>No clients yet.</Empty>}

    {dialog?.type === 'client' && <ClientDialog
      client={dialog.value}
      actions={actions}
      onClose={() => setDialog(null)}
      onSaved={(row) => { setDialog(null); if (row?.id) setSelectedId(row.id) }}
      onDeleted={() => { setDialog(null); setSelectedId(null) }}
    />}
    {dialog?.type === 'project' && <ProjectDialog project={dialog.value} data={data} actions={actions} onClose={() => setDialog(null)}/>}
    {dialog?.type === 'payment' && <PaymentDialog payment={dialog.value} data={data} actions={actions} onClose={() => setDialog(null)}/>}
  </section>
}
