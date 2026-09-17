import { useState } from 'react'
import Dialog from './Dialog.jsx'
import Icon from '../lib/icons.jsx'
import { Payment } from './ProjectCells.jsx'
import { Code, Switch, Tag } from './UI.jsx'
import { dateLabel, today } from '../lib/format.js'
import { DATE_FIELDS, datesFor, SERVICES, serviceLabel, STATUS_LABELS, STATUSES, statusKey, suggestProjectId } from '../lib/projects.js'

const blank = {
  project_id: '', title: '', client_id: '', status: 'lead', services: [], negotiated_price: '', payment_status: 'unpaid',
  footage_downloaded: false, track_time: false, footage_received_at: null, first_cut_sent_at: null, delivered_at: null, paid_at: null,
  notes: '', vsl_package: null,
}

// Moving a project on fills in the date that step stands for, if it is still empty.
const DATE_FOR_STATUS = { 'footage sent': 'footage_received_at', review: 'first_cut_sent_at', 'final delivery': 'delivered_at' }

const vslOf = (value) => ({ main_video: true, thank_you_video: Boolean(value?.thank_you_video), breakout_count: Math.max(0, Number(value?.breakout_count) || 0) })

function ToggleRow({ title, hint, on, onChange }) {
  return <div className="toggle-row">
    <span><strong>{title}</strong><small>{hint}</small></span>
    <Switch on={Boolean(on)} onChange={onChange} label={title}/>
  </div>
}

function VslPackage({ value, onChange }) {
  return <div className="subpanel span-2">
    <div className="subpanel-head"><strong>VSL package</strong><small>The main video is always included. Each piece gets its own timer.</small></div>
    <ToggleRow title="Thank-you video" hint="The follow-up after sign-up." on={value.thank_you_video} onChange={(thank_you_video) => onChange({ ...value, thank_you_video })}/>
    <div className="toggle-row">
      <span><strong>Breakout videos</strong><small>Short pieces cut from the main video.</small></span>
      <span className="stepper">
        <button type="button" className="icon-button" aria-label="One fewer" onClick={() => onChange({ ...value, breakout_count: Math.max(0, value.breakout_count - 1) })}><Icon name="minus" size={15}/></button>
        <output>{value.breakout_count}</output>
        <button type="button" className="icon-button" aria-label="One more" onClick={() => onChange({ ...value, breakout_count: value.breakout_count + 1 })}><Icon name="plus" size={15}/></button>
      </span>
    </div>
  </div>
}

export default function ProjectDialog({ project, data, actions, onClose }) {
  const isNew = !project?.id
  const [form, setForm] = useState(() => ({ ...blank, ...project, services: project?.services || [] }))
  const [idTouched, setIdTouched] = useState(!isNew)
  const [newClient, setNewClient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name))

  const chooseClient = (value) => {
    if (value === '__new') { setNewClient(''); set({ client_id: '' }); return }
    const client = clients.find((item) => String(item.id) === String(value))
    set({ client_id: value, ...(!idTouched ? { project_id: suggestProjectId(data.projects, value, client?.name) } : {}) })
  }
  const nameNewClient = (name) => {
    setNewClient(name)
    if (!idTouched) set({ project_id: suggestProjectId([], null, name) })
  }
  const chooseStatus = (status) => {
    const field = DATE_FOR_STATUS[status]
    set({ status, ...(field && !form[field] ? { [field]: today() } : {}) })
  }
  const chooseService = (service) => {
    const active = form.services?.includes(service)
    set({ services: active ? [] : [service], ...(service === 'VSL' && !active ? { vsl_package: vslOf(form.vsl_package) } : {}) })
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      let clientId = form.client_id
      if (newClient !== null && newClient.trim()) clientId = (await actions.createClient({ name: newClient.trim() })).id
      const { id, created_at, user_id, payments, ...values } = form
      const services = values.services || []
      const payload = {
        ...values,
        services,
        client_id: clientId ? Number(clientId) : null,
        negotiated_price: values.negotiated_price === '' || values.negotiated_price == null ? null : Number(values.negotiated_price),
        vsl_package: services.includes('VSL') ? vslOf(values.vsl_package) : (values.vsl_package ?? null),
      }
      for (const [field] of DATE_FIELDS) if (!payload[field]) payload[field] = null
      if (isNew) await actions.createProject(payload)
      else await actions.updateProject(project.id, payload)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save this project.')
      setSaving(false)
    }
  }

  const title = isNew ? 'New project' : <><Code project={form}/><span className="dialog-title-text">{form.title || 'Untitled'}</span></>
  const footer = <>
    {!isNew && <button type="button" className="text-button text-button--danger push" onClick={() => setConfirming(true)}>Delete</button>}
    {error && <span className="form-error">{error}</span>}
    <button type="button" className="button" onClick={onClose}>Cancel</button>
    <button type="submit" form="project-form" className="button button--solid" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create project' : 'Save'}</button>
  </>

  return <>
    <Dialog title={title} onClose={onClose} footer={footer} wide>
      <form id="project-form" className="form-grid" onSubmit={submit}>
        <div className="field">
          <span className="field-label">Client</span>
          {newClient === null
            ? <select className="select" required value={form.client_id || ''} onChange={(event) => chooseClient(event.target.value)}>
                <option value="" disabled>Choose a client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                <option value="__new">+ New client</option>
              </select>
            : <span className="inline-new">
                <input className="input" autoFocus required placeholder="New client's name" value={newClient} onChange={(event) => nameNewClient(event.target.value)}/>
                <button type="button" className="text-button" onClick={() => setNewClient(null)}>Pick existing</button>
              </span>}
        </div>
        <label className="field">
          <span className="field-label">Project ID</span>
          <input className="input input--mono" value={form.project_id || ''} placeholder="ANT-22" onChange={(event) => { setIdTouched(true); set({ project_id: event.target.value.toUpperCase() }) }}/>
        </label>
        <label className="field span-2">
          <span className="field-label">Title</span>
          <input className="input" required value={form.title || ''} placeholder="What the video is called" onChange={(event) => set({ title: event.target.value })}/>
        </label>

        <div className="field span-2">
          <span className="field-label">Status</span>
          <div className="choices">{STATUSES.map((status) => <button type="button" key={status} aria-pressed={form.status === status} className={`choice ${form.status === status ? 'is-active' : ''}`} onClick={() => chooseStatus(status)}>
            <i className={`dot s-${statusKey(status)}`}/>{STATUS_LABELS[status]}
          </button>)}</div>
        </div>
        <div className="field span-2">
          <span className="field-label">Type</span>
          <div className="choices">{SERVICES.map((service) => <button type="button" key={service} aria-pressed={form.services?.includes(service)} className={`choice ${form.services?.includes(service) ? 'is-active' : ''}`} onClick={() => chooseService(service)}>{serviceLabel(service)}</button>)}</div>
        </div>
        {form.services?.includes('VSL') && <VslPackage value={vslOf(form.vsl_package)} onChange={(vsl_package) => set({ vsl_package })}/>}

        <label className="field">
          <span className="field-label">Price · USD</span>
          <input className="input input--mono" type="number" min="0" step="0.01" inputMode="decimal" placeholder="150" value={form.negotiated_price ?? ''} onChange={(event) => set({ negotiated_price: event.target.value })}/>
        </label>
        <div className="field">
          <span className="field-label">Payment</span>
          <span className="payment-note">
            <Payment project={form}/>
            <small>{form.payment_status === 'paid' && form.paid_at ? `on ${dateLabel(form.paid_at)}` : 'Set when you log a payment in Finance'}</small>
          </span>
        </div>

        {datesFor(form.status).filter(([field]) => field !== 'paid_at').map(([field, label]) => <label className="field" key={field}>
          <span className="field-label">{label}</span>
          <input className="input" type="date" value={form[field]?.slice(0, 10) || ''} onChange={(event) => set({ [field]: event.target.value || null })}/>
        </label>)}

        <div className="toggles span-2">
          <ToggleRow title="Footage downloaded" hint="The source files are on your machine." on={form.footage_downloaded} onChange={(footage_downloaded) => set({ footage_downloaded })}/>
          <ToggleRow title="Track time" hint="Show this project on the Time page." on={form.track_time} onChange={(track_time) => set({ track_time })}/>
        </div>

        <label className="field span-2">
          <span className="field-label">Notes</span>
          <textarea className="textarea" rows="3" value={form.notes || ''} onChange={(event) => set({ notes: event.target.value })}/>
        </label>
      </form>
    </Dialog>

    {confirming && <Dialog
      title={`Delete ${form.project_id || 'this project'}?`}
      onClose={() => setConfirming(false)}
      footer={<>
        <button type="button" className="button" onClick={() => setConfirming(false)}>Keep it</button>
        <button type="button" className="button button--danger" onClick={async () => { await actions.deleteProject(project.id); onClose() }}>Delete project</button>
      </>}
    ><p>This removes the project and its tracked time. It cannot be undone.</p></Dialog>}
  </>
}
