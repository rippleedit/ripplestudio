import Icon from '../lib/icons.jsx'
import { STATUS_LABELS, statusKey } from '../lib/projects.js'

// Each client has its own colour for their job codes and initials. None of these
// is the signal orange or a status colour, so a client never reads as a state.
const CLIENT_COLORS = ['#b79cff', '#e6c25a', '#f08fc0', '#a8d672', '#6fd8e0', '#d6a98a', '#8fa8ff', '#dd8be6']

// Filled from the data after every load (App calls registerClients): colours follow
// the order clients were added in, pictures come from clients.avatar. No client
// names are written in this file: it ships inside the public site.
const byId = new Map()
const byName = new Map()
const nameKey = (name) => String(name || '').trim().toLowerCase()

export function registerClients(clients) {
  byId.clear()
  byName.clear()
  ;[...clients].sort((a, b) => Number(a.id) - Number(b.id)).forEach((client, index) => {
    const info = { color: CLIENT_COLORS[index % CLIENT_COLORS.length], avatar: client.avatar || null }
    byId.set(Number(client.id), info)
    byName.set(nameKey(client.name), info)
  })
}

export const clientColor = (clientId) => byId.get(Number(clientId))?.color || 'var(--white-52)'

export function colourFor(name = '') {
  const known = byName.get(nameKey(name))?.color
  if (known) return known
  let hash = 0
  for (const char of String(name)) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return CLIENT_COLORS[hash % CLIENT_COLORS.length]
}

export function initials(value = '') {
  const parts = String(value).trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2) || '?').toUpperCase()
}

// size: 'sm' | 'lg'; the default suits lists. Pass src for a specific picture, or null for initials.
export function Avatar({ name, size, src, tint }) {
  const image = src !== undefined ? src : byName.get(nameKey(name))?.avatar
  const className = ['avatar', size && `avatar--${size}`, image && 'has-photo'].filter(Boolean).join(' ')
  return <span className={className} style={{ '--tint': tint || colourFor(name) }}>
    {initials(name)}
    {image && <img src={image} alt="" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.classList.remove('has-photo') }}/>}
  </span>
}

export function Status({ project }) {
  return <span className={`status s-${statusKey(project.status)}`}><i/>{STATUS_LABELS[project.status] || project.status || 'Unknown'}</span>
}

export function Pill({ tone = 'done', children }) { return <span className={`status ${tone}`}><i/>{children}</span> }

export function Tag({ children }) { return children ? <span className="tag">{children}</span> : null }

// A job code in its client's colour.
export function Code({ project }) {
  return project?.project_id ? <span className="tag code" style={{ '--tint': clientColor(project.client_id) }}>{project.project_id}</span> : null
}

export function Tile({ value, label, note, tone = '' }) {
  return <div className={`tile ${tone}`}><strong>{value}</strong><span>{label}</span>{note && <small>{note}</small>}</div>
}

export function Block({ title, count, hint, tools, children }) {
  return <section className="block">
    <header className="block-head">
      <h2>{title}</h2>
      {count != null && <span className="count">{count}</span>}
      {hint && <p>{hint}</p>}
      {tools && <div className="block-tools">{tools}</div>}
    </header>
    {children}
  </section>
}

export function Search({ value, onChange, placeholder = 'Search' }) {
  return <label className="search"><Icon name="search" size={16}/><input className="input" type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder}/></label>
}

export function Segmented({ options, value, onChange, label }) {
  return <div className="segmented" role="group" aria-label={label}>
    {options.map(([key, text, count]) => <button type="button" key={key} aria-pressed={value === key} className={value === key ? 'is-active' : ''} onClick={() => onChange(key)}>
      {text}{count != null && <i>{count}</i>}
    </button>)}
  </div>
}

export function Switch({ on, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={Boolean(on)} aria-label={label} disabled={disabled} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}/>
}

export function Empty({ children }) { return <div className="empty">{children}</div> }

export function Spinner({ label = 'Loading' }) { return <span className="loading"><span className="spinner"/>{label}</span> }
