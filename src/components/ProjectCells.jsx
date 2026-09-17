import Icon from '../lib/icons.jsx'
import { usd } from '../lib/format.js'
import { isOpen, isUnpaid } from '../lib/projects.js'

// Table cells shared by Projects and Clients. Colour only where something needs you.

export function Footage({ project }) {
  if (project.status === 'closed') return null
  if (project.status === 'lead') return <span className="flag">No footage yet</span>
  return project.footage_downloaded
    ? <span className="flag"><Icon name="check" size={13}/>Downloaded</span>
    : <span className="flag is-attention"><Icon name="download" size={13}/>Not downloaded</span>
}

export function Price({ project }) {
  if (project.negotiated_price != null && project.negotiated_price !== '') return usd(project.negotiated_price)
  return isOpen(project) && project.status !== 'lead' ? <span className="flag is-attention">Needs price</span> : null
}

export function Payment({ project }) {
  if (project.payment_status === 'paid') return <span className="flag is-settled">Paid</span>
  if (project.payment_status === 'pending') return <span className="flag is-waiting">Pending</span>
  return <span className={`flag ${isUnpaid(project) ? 'is-attention' : ''}`}>Unpaid</span>
}
