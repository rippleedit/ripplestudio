import { toDate } from './format.js'

export const STATUSES = ['lead', 'footage sent', 'editing', 'review', 'revisions', 'final delivery', 'payment', 'closed']

export const STATUS_LABELS = {
  lead: 'Lead',
  'footage sent': 'Footage sent',
  editing: 'Editing',
  review: 'Review',
  revisions: 'Revisions',
  'final delivery': 'Final delivery',
  payment: 'Payment',
  closed: 'Closed',
}

export const SERVICES = ['Long-form (YouTube)', 'Short-form (Reels, TikTok, Shorts)', 'Thumbnail', 'Video Title', 'Data Analysis', 'VSL']

const SERVICE_SHORT = {
  'Long-form (YouTube)': 'Long-form',
  'YouTube Long Form': 'Long-form',
  'Short-form (Reels, TikTok, Shorts)': 'Short-form',
  'Short Form Clipping': 'Short-form',
  'Video Title': 'Title',
  'Data Analysis': 'Data analysis',
}
export const serviceLabel = (service) => SERVICE_SHORT[service] || service || ''

// The dates that matter once a project has reached a status: [field, label, from status].
export const DATE_FIELDS = [
  ['footage_received_at', 'Footage received', 'footage sent'],
  ['first_cut_sent_at', 'First cut sent', 'review'],
  ['delivered_at', 'Delivered', 'final delivery'],
  ['paid_at', 'Paid on', 'payment'],
]
export const datesFor = (status) => DATE_FIELDS.filter(([, , from]) => STATUSES.indexOf(status) >= STATUSES.indexOf(from))

const delivered = (project) => ['final delivery', 'payment'].includes(project.status)
export const isOpen = (project) => project.status !== 'closed'
export const isUnpaid = (project) => delivered(project) && project.payment_status !== 'paid'
// Some older projects have no delivery date; fall back to the nearest date we do have.
export const deliveredOn = (project) => project.delivered_at || project.first_cut_sent_at || project.created_at

// Whose move it is, what the move is, and how long it has been waiting.
// Tones follow the family: orange needs you, blue waits on someone else,
// green is settled, grey is done.
// key picks the step's own colour (the .s-* classes in styles.css).
export function nextStep(project) {
  const { status } = project
  if (status === 'closed') return { lane: 'done', tone: 'done', key: 'closed', label: 'Closed' }
  if (delivered(project)) {
    return project.payment_status === 'paid'
      ? { lane: 'you', tone: 'settled', key: 'paid', label: 'Paid · close it', since: project.paid_at }
      : { lane: 'collect', tone: 'attention', key: 'delivered', label: 'Awaiting payment', since: deliveredOn(project) }
  }
  if (status === 'lead') return { lane: 'client', tone: 'waiting', key: 'lead', label: 'Waiting for footage', since: project.created_at }
  if (status === 'review') return { lane: 'client', tone: 'waiting', key: 'review', label: 'Client reviewing', since: project.first_cut_sent_at || project.created_at }
  if (status === 'footage sent') {
    return project.footage_downloaded
      ? { lane: 'you', tone: 'attention', key: 'start', label: 'Start the edit', since: project.footage_received_at || project.created_at }
      : { lane: 'you', tone: 'attention', key: 'footage', label: 'Download footage', since: project.footage_received_at || project.created_at }
  }
  if (status === 'revisions') return { lane: 'you', tone: 'attention', key: 'revisions', label: 'Revisions', since: project.first_cut_sent_at || project.created_at }
  return { lane: 'you', tone: 'attention', key: 'editing', label: 'In the edit', since: project.footage_received_at || project.created_at }
}

export const statusTone = (project) => nextStep(project).tone

// Each status name has its own colour in the status column.
const STATUS_KEYS = { lead: 'lead', 'footage sent': 'footage', editing: 'editing', review: 'review', revisions: 'revisions', 'final delivery': 'delivered', payment: 'paid', closed: 'closed' }
export const statusKey = (status) => STATUS_KEYS[status] || 'closed'

// Open projects sorted into lanes, longest waiting first.
export function byLane(projects) {
  const lanes = { you: [], client: [], collect: [] }
  for (const project of projects) {
    const step = nextStep(project)
    lanes[step.lane]?.push({ project, step })
  }
  const waited = ({ step }) => (step.since ? toDate(step.since).getTime() : Date.now())
  for (const lane of Object.values(lanes)) lane.sort((a, b) => waited(a) - waited(b))
  return lanes
}

// The date a finished project belongs to in the history.
export const workDate = (project) => project.paid_at || project.delivered_at || project.first_cut_sent_at || project.footage_received_at || project.created_at

// Time tracking --------------------------------------------------------------

export const STAGES = [
  ['project_setup', 'Setup'], ['sync', 'Sync'], ['rough_cut', 'Rough cut'], ['fine_cut', 'Fine cut'], ['animation', 'Animation'],
  ['color', 'Color'], ['audio', 'Audio'], ['captions', 'Captions'], ['export_upload', 'Export'], ['revisions', 'Revisions'],
]
export const stageLabel = (key) => STAGES.find(([value]) => value === key)?.[1] || (key ? String(key).replaceAll('_', ' ') : 'Unstaged')

// Every stage has its own colour, so the time bar reads at a glance.
const STAGE_COLORS = {
  project_setup: '#9fb3c8', sync: '#6fd8e0', rough_cut: '#ff7a5e', fine_cut: '#ffb547', animation: '#c792ff',
  color: '#ff5c8a', audio: '#5fb8ff', captions: '#a8d672', export_upload: '#56dcb4', revisions: '#e6c25a',
}
export const stageColor = (key) => STAGE_COLORS[key] || 'rgba(242, 240, 234, 0.28)'

// A VSL is timed piece by piece; every other project is one piece (null).
export function trackedPieces(project) {
  if (!project.services?.includes('VSL')) return [null]
  const pkg = project.vsl_package || {}
  return [
    'main_video',
    ...(pkg.thank_you_video ? ['thank_you_video'] : []),
    ...Array.from({ length: Math.max(0, Number(pkg.breakout_count) || 0) }, (_, index) => `breakout_${index + 1}`),
  ]
}
export const pieceOf = (entry) => entry.vsl_item || 'main_video'
export function pieceLabel(key) {
  if (!key) return ''
  if (key === 'main_video') return 'Main VSL'
  if (key === 'thank_you_video') return 'Thank-you video'
  const breakout = /^breakout_(\d+)$/.exec(key)
  return breakout ? `Breakout ${breakout[1]}` : String(key).replaceAll('_', ' ')
}

export const trackedSeconds = (entries) => entries.reduce((sum, entry) => (entry.ended_at ? sum + Number(entry.duration_seconds || 0) : sum), 0)

export function secondsThisWeek(entries, now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return trackedSeconds(entries.filter((entry) => toDate(entry.started_at) >= monday))
}

// Next job code for a client: ANT-21 becomes ANT-22; a new client gets letters from their name.
export function suggestProjectId(projects, clientId, clientName = '') {
  const latest = projects
    .filter((project) => clientId != null && String(project.client_id) === String(clientId))
    .map((project) => String(project.project_id || '').trim().match(/^(.*?)(\d+)$/))
    .filter(Boolean)
    .map(([, prefix, number]) => ({ prefix, number: Number(number) }))
    .sort((a, b) => b.number - a.number)[0]
  if (latest) return `${latest.prefix}${latest.number + 1}`
  const words = String(clientName).trim().split(/[^A-Za-z0-9]+/).filter(Boolean)
  const letters = (words.length > 1 ? words.slice(0, 3).map((word) => word[0]).join('') : (words[0] || '').slice(0, 3)).toUpperCase()
  return letters ? `${letters}-1` : ''
}
