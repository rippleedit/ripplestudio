import { useMemo, useState } from 'react'
import Dialog from './Dialog.jsx'
import Icon from '../lib/icons.jsx'
import { Code, Status, Tag } from './UI.jsx'
import { money, today, usd } from '../lib/format.js'
import { isOpen, isUnpaid } from '../lib/projects.js'

export const invoiceNumber = (payment) => payment.invoice_number || `RE-${String(payment.date).replaceAll('-', '')}-${String(payment.id ?? '').padStart(2, '0')}`

export function invoiceText(payment, data) {
  const client = data.clients.find((item) => Number(item.id) === Number(payment.client_id))
  const ids = (payment.project_ids || []).map(Number)
  const projects = data.projects.filter((project) => ids.includes(Number(project.id)))
  return [
    `Invoice: ${invoiceNumber(payment)}`,
    `Payment date: ${payment.date}`,
    `Client: ${client?.name || 'No client'}`,
    `Projects: ${projects.map((project) => `${project.project_id} ${project.title}`).join(', ') || 'None linked'}`,
    `Amount received: ${money(payment.amount, payment.currency)}`,
  ].join('\n')
}

export default function PaymentDialog({ payment, data, actions, onClose, save, amountHint }) {
  const isNew = !payment?.id
  const [form, setForm] = useState(() => ({
    client_id: '', amount: '', currency: 'EUR', date: today(), invoice_number: '', notes: '',
    ...payment,
    project_ids: (payment?.project_ids || []).map(Number),
  }))
  // The order is fixed when the dialog opens, so ticking a project never makes the list jump.
  const [linkedAtOpen] = useState(() => new Set((payment?.project_ids || []).map(Number)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name))

  const candidates = useMemo(() => {
    const rank = (project) => (linkedAtOpen.has(Number(project.id)) ? 0 : isUnpaid(project) ? 1 : isOpen(project) ? 2 : 3)
    return data.projects
      .filter((project) => Number(project.client_id) === Number(form.client_id))
      .sort((a, b) => rank(a) - rank(b) || String(b.project_id || '').localeCompare(String(a.project_id || ''), undefined, { numeric: true }))
  }, [data.projects, form.client_id, linkedAtOpen])
  const chosen = candidates.filter((project) => form.project_ids.includes(Number(project.id)))
  const quoted = chosen.reduce((sum, project) => sum + Number(project.negotiated_price || 0), 0)
  const toggle = (id) => set({ project_ids: form.project_ids.includes(id) ? form.project_ids.filter((value) => value !== id) : [...form.project_ids, id] })

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { id, created_at, user_id, ...values } = form
      await (save || actions.savePayment)({
        ...values,
        client_id: Number(values.client_id),
        amount: Number(values.amount),
        invoice_number: values.invoice_number || null,
        notes: values.notes || null,
        project_ids: values.project_ids,
      }, payment?.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save this payment.')
      setSaving(false)
    }
  }
  const copy = async () => {
    await navigator.clipboard.writeText(invoiceText(form, data))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return <>
    <Dialog wide title={isNew ? 'Log payment' : `Payment · ${form.date}`} onClose={onClose} footer={<>
      {!isNew && <button type="button" className="text-button text-button--danger push" onClick={() => setConfirming(true)}>Delete</button>}
      {!isNew && <button type="button" className="text-button" onClick={copy}>{copied ? 'Copied' : 'Copy invoice info'}</button>}
      {error && <span className="form-error">{error}</span>}
      <button type="button" className="button" onClick={onClose}>Cancel</button>
      <button type="submit" form="payment-form" className="button button--solid" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Log payment' : 'Save'}</button>
    </>}>
      <form id="payment-form" className="form-grid" onSubmit={submit}>
        <label className="field span-2">
          <span className="field-label">Client</span>
          <select className="select" required value={form.client_id || ''} onChange={(event) => set({ client_id: event.target.value, project_ids: [] })}>
            <option value="" disabled>Choose a client</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Amount received · {form.currency || 'EUR'}</span>
          <input className="input input--mono" type="number" min="0" step="0.01" inputMode="decimal" required value={form.amount} onChange={(event) => set({ amount: event.target.value })}/>
          {amountHint && <span className="field-hint">{amountHint}</span>}
        </label>
        <label className="field">
          <span className="field-label">Date received</span>
          <input className="input" type="date" required value={String(form.date || '').slice(0, 10)} onChange={(event) => set({ date: event.target.value })}/>
        </label>

        <div className="field span-2">
          <span className="field-row">
            <span className="field-label">Covers</span>
            <span className="field-hint">{chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'project' : 'projects'} · ${usd(quoted)} quoted` : 'Tick the projects this pays for'}</span>
          </span>
          {!form.client_id
            ? <p className="block-empty">Choose a client first.</p>
            : candidates.length
              ? <div className="pick-list">{candidates.map((project) => {
                  const on = form.project_ids.includes(Number(project.id))
                  return <button type="button" role="checkbox" aria-checked={on} key={project.id} className={`pick ${on ? 'is-on' : ''}`} onClick={() => toggle(Number(project.id))}>
                    <span className="pick-box"><Icon name="check" size={12}/></span>
                    <Code project={project}/>
                    <span className="pick-title">{project.title}</span>
                    <Status project={project}/>
                    <span className="pick-price">{project.negotiated_price ? usd(project.negotiated_price) : ''}</span>
                  </button>
                })}</div>
              : <p className="block-empty">This client has no projects yet.</p>}
        </div>

        <label className="field">
          <span className="field-label">Invoice number</span>
          <input className="input input--mono" placeholder={isNew ? 'Optional' : invoiceNumber(form)} value={form.invoice_number || ''} onChange={(event) => set({ invoice_number: event.target.value })}/>
        </label>
        <label className="field span-2">
          <span className="field-label">Notes</span>
          <textarea className="textarea" rows="2" value={form.notes || ''} onChange={(event) => set({ notes: event.target.value })}/>
        </label>
      </form>
    </Dialog>

    {confirming && <Dialog title="Delete this payment?" onClose={() => setConfirming(false)} footer={<>
      <button type="button" className="button" onClick={() => setConfirming(false)}>Keep it</button>
      <button type="button" className="button button--danger" onClick={async () => { await actions.deletePayment(payment.id); onClose() }}>Delete payment</button>
    </>}><p>The projects it covers go back to unpaid. This cannot be undone.</p></Dialog>}
  </>
}
