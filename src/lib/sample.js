// Made-up studio data for demo mode (when no Supabase settings are present).
// Every name, note and amount is invented, and dates count back from today so
// the demo always looks current. Never copy real business data into this file:
// it ships inside the public site.

const pad = (value) => String(value).padStart(2, '0')
const now = new Date()
const at = (daysAgo, hour = 11) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour)
const day = (daysAgo) => {
  if (daysAgo == null) return null
  const date = at(daysAgo)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const LONG = 'Long-form (YouTube)'
const SHORT = 'Short-form (Reels, TikTok, Shorts)'
const VSL = 'VSL'

export const demoClients = [
  { id: 1, name: 'Harbor Sound', email: 'team@harborsound.example', phone: '', notes: 'Weekly cookup videos. Likes a fast intro.', created_at: at(260).toISOString() },
  { id: 2, name: 'Lumen Beats', email: '', phone: '', notes: 'Referral from Harbor Sound. Monthly reel packs.', created_at: at(210).toISOString() },
  { id: 3, name: 'Marlow Kane', email: 'marlow@example.com', phone: '+1 555 0142', notes: '', created_at: at(150).toISOString() },
  { id: 4, name: 'Nova Keys', email: '', phone: '', notes: 'Sells courses. Mostly VSL work.', created_at: at(120).toISOString() },
  { id: 5, name: 'Sierra Vale', email: '', phone: '', notes: '', created_at: at(40).toISOString() },
]

// id, client, job code, title, status, type, price (USD), paid,
// days ago: footage received, first cut, delivered, paid; footage downloaded, tracked
const PROJECTS = [
  [1, 1, 'HAR-1', 'Studio Tour', 'closed', LONG, 150, true, 250, 246, 243, 240, true, false],
  [2, 1, 'HAR-2', 'Sample Flip Breakdown', 'closed', LONG, 150, true, 225, 221, 219, 214, true, false],
  [3, 2, 'LUM-1', 'Beat From Scratch', 'closed', LONG, 120, true, 200, 196, 193, 190, true, false],
  [4, 1, 'HAR-3', 'Drum Bus Secrets', 'closed', LONG, 150, true, 180, 176, 174, 170, true, true],
  [5, 2, 'LUM-2', 'Reel Pack: Spring', 'closed', SHORT, 90, true, 160, 158, 156, 150, true, false],
  [6, 3, 'MAR-1', 'Placement Story', 'closed', LONG, 200, true, 140, 135, 132, 128, true, true],
  [7, 4, 'NOV-1', 'Course Launch VSL', 'closed', VSL, 250, true, 115, 108, 104, 98, true, true],
  [8, 1, 'HAR-4', 'Cookup With Friends', 'closed', LONG, 150, true, 100, 96, 94, 90, true, true],
  [9, 3, 'MAR-2', 'Mixing Vocals Fast', 'closed', LONG, 200, true, 85, 80, 78, 72, true, true],
  [10, 2, 'LUM-3', 'Reel Pack: Summer', 'closed', SHORT, 90, true, 70, 68, 66, 20, true, false],
  [11, 1, 'HAR-5', 'Vintage Gear Review', 'closed', LONG, 150, true, 55, 51, 49, 45, true, true],
  [12, 4, 'NOV-2', 'Thank-You Page Video', 'closed', VSL, 150, true, 48, 44, 42, 38, true, true],
  [13, 3, 'MAR-3', 'Q&A Livestream Cut', 'closed', LONG, 180, true, 35, 31, 29, 24, true, true],
  [14, 2, 'LUM-4', 'Reel Pack: August', 'closed', SHORT, 90, true, 30, 28, 26, 20, true, false],
  [15, 1, 'HAR-6', 'Loop Kit Walkthrough', 'final delivery', LONG, 150, false, 16, 12, 9, null, true, true],
  [16, 3, 'MAR-4', 'Studio Session Vlog', 'payment', LONG, 200, true, 22, 18, 15, 11, true, true],
  [17, 2, 'LUM-5', 'Reel Pack: September', 'review', SHORT, 90, false, 10, 3, null, null, true, true],
  [18, 4, 'NOV-3', 'Webinar VSL', 'editing', VSL, 300, false, 8, null, null, null, true, true],
  [19, 1, 'HAR-7', 'Chopping Soul Samples', 'editing', LONG, 150, false, 5, null, null, null, true, true],
  [20, 5, 'SIE-1', 'Artist Intro Video', 'footage sent', LONG, null, false, 2, null, null, null, false, false],
  [21, 3, 'MAR-5', 'Behind the Beat', 'revisions', LONG, 200, false, 12, 4, null, null, true, true],
  [22, 5, 'SIE-2', 'Tour Recap', 'lead', LONG, null, false, null, null, null, null, false, false],
]

export const demoProjects = PROJECTS.map(([id, client_id, project_id, title, status, service, price, paid, received, firstCut, delivered, paidOn, downloaded, tracked]) => ({
  id,
  client_id,
  project_id,
  title,
  status,
  services: [service],
  footage_downloaded: downloaded,
  vsl_package: service === VSL ? { main_video: true, thank_you_video: id === 18, breakout_count: id === 18 ? 2 : 0 } : null,
  operator: 'Razz',
  footage_received_at: day(received),
  first_cut_sent_at: day(firstCut),
  delivered_at: day(delivered),
  paid_at: paid ? day(paidOn) : null,
  payment_status: paid ? 'paid' : 'unpaid',
  notes: '',
  negotiated_price: price,
  track_time: tracked,
  created_at: at((received ?? 0) + 2).toISOString(),
}))

// id, client, amount received (EUR), days ago, projects it covers
const PAYMENTS = [
  [1, 1, 138, 240, [1]], [2, 1, 138, 214, [2]], [3, 2, 110, 190, [3]], [4, 1, 138, 170, [4]],
  [5, 2, 83, 150, [5]], [6, 3, 184, 128, [6]], [7, 4, 230, 98, [7]], [8, 1, 138, 90, [8]],
  [9, 3, 184, 72, [9]], [10, 1, 138, 45, [11]], [11, 4, 138, 38, [12]], [12, 3, 166, 24, [13]],
  [13, 2, 166, 20, [10, 14]], [14, 3, 184, 11, [16]],
]

export const demoPayments = PAYMENTS.map(([id, client_id, amount, daysAgo, project_ids]) => ({
  id,
  client_id,
  amount,
  currency: 'EUR',
  usd_equivalent: null,
  service_description: null,
  date: day(daysAgo),
  notes: '',
  invoice_number: null,
  created_at: at(daysAgo, 18).toISOString(),
  project_ids,
}))

// Minutes per stage for a typical edit; each project scales it a little.
const STANDARD = [
  ['project_setup', 10], ['sync', 6], ['rough_cut', 90], ['fine_cut', 45], ['animation', 30],
  ['color', 20], ['audio', 35], ['captions', 25], ['export_upload', 12],
]
const STAGES_DONE = { 18: 3, 19: 3 }

export const demoTimeEntries = []
for (const [id, , , , status, service, , , received, , delivered, , , tracked] of PROJECTS) {
  if (!tracked) continue
  const stages = STANDARD.slice(0, STAGES_DONE[id] ?? STANDARD.length)
  if (status === 'revisions') stages.push(['revisions', 25])
  const scale = 0.75 + (id % 5) * 0.12
  const span = Math.max(1, received - (delivered ?? 0) - 1)
  stages.forEach(([stage, minutes], index) => {
    const start = at(Math.max(0, received - 1 - Math.floor((index * span) / stages.length)), 10 + (index % 6))
    const seconds = Math.round(minutes * scale) * 60
    demoTimeEntries.push({
      id: demoTimeEntries.length + 1,
      project_id: id,
      vsl_item: service === VSL ? 'main_video' : null,
      stage,
      started_at: start.toISOString(),
      ended_at: new Date(start.getTime() + seconds * 1000).toISOString(),
      duration_seconds: seconds,
      paused_at: null,
      paused_seconds: 0,
      adjustment_seconds: 0,
      note: null,
      created_at: start.toISOString(),
    })
  })
}

// Two PayPal payments waiting to be matched: one from a sender already known as a
// client (paid in dollars, converted), one from someone new.
export const demoPaypal = [
  { id: 'DEMO-PP-2', happened_at: at(1, 16).toISOString(), payer_email: 'team@harborsound.example', payer_name: 'Harbor Sound', gross: 162.5, fee: -6.21, currency: 'USD', received_eur: 139.4, note: 'Loop Kit Walkthrough', client_id: 1, status: 'new', payment_id: null },
  { id: 'DEMO-PP-1', happened_at: at(3, 9).toISOString(), payer_email: 'j.rivera@example.com', payer_name: 'Jordan Rivera', gross: 60, fee: -2.46, currency: 'EUR', received_eur: 57.54, note: null, client_id: null, status: 'new', payment_id: null },
]
