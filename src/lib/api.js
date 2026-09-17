import { createClient } from '@supabase/supabase-js'
import { demoClients, demoPaypal, demoPayments, demoProjects, demoTimeEntries } from './sample.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const demoMode = !url || !key
const supabase = demoMode ? null : createClient(url, key)

let demo = {
  clients: structuredClone(demoClients),
  projects: structuredClone(demoProjects),
  payments: structuredClone(demoPayments),
  time_entries: structuredClone(demoTimeEntries),
  paypal: structuredClone(demoPaypal),
}

const nextId = (rows) => Math.max(0, ...rows.map((row) => Number(row.id))) + 1
const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), 120))
const check = ({ data, error }) => { if (error) throw error; return data }

export const auth = {
  async session() {
    if (demoMode) return new URLSearchParams(location.search).has('signin') ? null : { user: { id: 'demo', email: 'razz@ripple-edit.com' } }
    return (await supabase.auth.getSession()).data.session
  },
  async signIn(email, password) {
    if (demoMode) return delay({ user: { id: 'demo', email } })
    return check(await supabase.auth.signInWithPassword({ email, password }))
  },
  async signOut() {
    if (demoMode) return delay(true)
    return check(await supabase.auth.signOut())
  },
  onChange(callback) {
    if (demoMode) return () => {}
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
    return () => data.subscription.unsubscribe()
  },
}

// Supabase hands out at most 1,000 rows per request (its default "max rows"),
// so every table is read page by page until a short page says it is done.
const PAGE = 1000
async function everyRow(query) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const page = check(await query().range(from, from + PAGE - 1))
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

async function list(table, order = 'created_at') {
  if (demoMode) return delay(demo[table])
  return everyRow(() => supabase.from(table).select('*').order(order, { ascending: false }).order('id', { ascending: false }))
}

async function insert(table, values) {
  if (demoMode) {
    const row = { ...values, id: nextId(demo[table]), created_at: new Date().toISOString() }
    demo[table].push(row)
    return delay(row)
  }
  return check(await supabase.from(table).insert(values).select().single())
}

async function update(table, id, values) {
  if (demoMode) {
    demo[table] = demo[table].map((row) => Number(row.id) === Number(id) ? { ...row, ...values } : row)
    return delay(demo[table].find((row) => Number(row.id) === Number(id)))
  }
  return check(await supabase.from(table).update(values).eq('id', id).select().single())
}

async function remove(table, id) {
  if (demoMode) {
    demo[table] = demo[table].filter((row) => Number(row.id) !== Number(id))
    return delay(true)
  }
  return check(await supabase.from(table).delete().eq('id', id))
}

// A project goes back to unpaid only when no payment covers it any more.
async function releaseProjects(projectIds) {
  const ids = projectIds.map(Number)
  if (!ids.length) return
  if (demoMode) {
    const covered = new Set(demo.payments.flatMap((row) => (row.project_ids || []).map(Number)))
    demo.projects = demo.projects.map((row) => (ids.includes(Number(row.id)) && !covered.has(Number(row.id)) ? { ...row, payment_status: 'unpaid', paid_at: null } : row))
    return
  }
  const covered = new Set(check(await supabase.from('payment_projects').select('project_id').in('project_id', ids)).map((row) => Number(row.project_id)))
  const uncovered = ids.filter((id) => !covered.has(id))
  if (uncovered.length) check(await supabase.from('projects').update({ payment_status: 'unpaid', paid_at: null }).in('id', uncovered))
}

export const api = {
  loadAll: async () => {
    const [clients, projects, payments, time_entries, links, paypal] = await Promise.all([
      list('clients', 'name'), list('projects'), list('payments', 'date'), list('time_entries', 'started_at'),
      demoMode ? [] : everyRow(() => supabase.from('payment_projects').select('payment_id,project_id').order('payment_id').order('project_id')),
      api.loadPaypal(),
    ])
    if (demoMode) return { clients: clients.sort((a, b) => a.name.localeCompare(b.name)), projects, payments, time_entries, paypal }
    const covers = new Map()
    for (const link of links) {
      if (!covers.has(link.payment_id)) covers.set(link.payment_id, [])
      covers.get(link.payment_id).push(link.project_id)
    }
    return {
      clients,
      projects: projects.map((p) => ({ ...p, services: p.services || [], vsl_package: p.vsl_package || null })),
      payments: payments.map((p) => ({ ...p, project_ids: covers.get(p.id) || [] })),
      time_entries,
      paypal,
    }
  },
  createClient: (values) => insert('clients', values),
  updateClient: (id, values) => update('clients', id, values),
  async deleteClient(id) {
    if (demoMode) {
      const projectIds = demo.projects.filter((row) => Number(row.client_id) === Number(id)).map((row) => row.id)
      demo.time_entries = demo.time_entries.filter((row) => !projectIds.includes(row.project_id))
      demo.projects = demo.projects.filter((row) => Number(row.client_id) !== Number(id))
      demo.payments = demo.payments.filter((row) => Number(row.client_id) !== Number(id))
    }
    return remove('clients', id)
  },
  createProject: (values) => insert('projects', values),
  updateProject: (id, values) => update('projects', id, values),
  async deleteProject(id) {
    if (demoMode) {
      demo.time_entries = demo.time_entries.filter((row) => Number(row.project_id) !== Number(id))
      demo.payments = demo.payments.map((row) => ({ ...row, project_ids: (row.project_ids || []).filter((projectId) => Number(projectId) !== Number(id)) }))
    }
    return remove('projects', id)
  },
  // Finance is the only place a project becomes paid: logging a payment marks the
  // projects it covers, and unticking one releases it if nothing else covers it.
  async savePayment(values, id = null) {
    const { project_ids: chosen = [], ...payment } = values
    const project_ids = chosen.map(Number)
    const before = (demoMode
      ? (demo.payments.find((row) => Number(row.id) === Number(id))?.project_ids || [])
      : id ? check(await supabase.from('payment_projects').select('project_id').eq('payment_id', id)).map((row) => row.project_id) : []).map(Number)
    const dropped = before.filter((projectId) => !project_ids.includes(projectId))
    const saved = id ? await update('payments', id, payment) : await insert('payments', payment)
    if (demoMode) {
      demo.payments = demo.payments.map((row) => (Number(row.id) === Number(saved.id) ? { ...row, project_ids } : row))
      demo.projects = demo.projects.map((row) => (project_ids.includes(Number(row.id)) ? { ...row, payment_status: 'paid', paid_at: payment.date } : row))
      await releaseProjects(dropped)
      return { ...saved, project_ids }
    }
    if (id) check(await supabase.from('payment_projects').delete().eq('payment_id', id))
    if (project_ids.length) {
      check(await supabase.from('payment_projects').insert(project_ids.map((project_id) => ({ payment_id: saved.id, project_id }))))
      check(await supabase.from('projects').update({ payment_status: 'paid', paid_at: payment.date }).in('id', project_ids))
    }
    await releaseProjects(dropped)
    return { ...saved, project_ids }
  },
  async deletePayment(id) {
    const linked = demoMode
      ? (demo.payments.find((row) => Number(row.id) === Number(id))?.project_ids || [])
      : check(await supabase.from('payment_projects').select('project_id').eq('payment_id', id)).map((row) => row.project_id)
    await remove('payments', id)
    await releaseProjects(linked)
    return true
  },
  async startTimer(project_id, stage, vsl_item = null) {
    return insert('time_entries', { project_id, stage, vsl_item, started_at: new Date().toISOString(), ended_at: null, duration_seconds: null, paused_at: null, paused_seconds: 0, adjustment_seconds: 0 })
  },
  async updateTimer(id, values) { return update('time_entries', id, values) },
  async addTime(values) { return insert('time_entries', values) },

  // Your own profile: display name and picture, like RippleReview's.
  async profile() {
    if (demoMode) return delay(demoProfile)
    const { data: { user } } = await supabase.auth.getUser()
    const row = check(await supabase.from('profiles').select('id, display_name, avatar').eq('id', user.id).maybeSingle())
    return { display_name: 'Razz', avatar: null, ...row, email: user.email }
  },
  async saveProfile(values) {
    if (demoMode) { demoProfile = { ...demoProfile, ...values }; return delay(demoProfile) }
    const { data: { user } } = await supabase.auth.getUser()
    const row = check(await supabase.from('profiles').upsert({ id: user.id, ...values }).select('id, display_name, avatar').single())
    return { ...row, email: user.email }
  },
  // PayPal: payments read by the paypal function, waiting to be matched.
  async loadPaypal() {
    if (demoMode) return delay(demo.paypal)
    const { data, error } = await supabase.from('paypal_transactions').select('*').eq('status', 'new').order('happened_at', { ascending: false }).limit(200)
    return error ? [] : data // not set up yet: nothing to show
  },
  async syncPaypal() {
    if (demoMode) return delay({ ok: true, added: 0, recognised: 0 })
    const { data, error } = await supabase.functions.invoke('paypal', { body: {} })
    if (error) {
      let message = error.message
      try { message = (await error.context.json()).error || message } catch { /* keep the generic message */ }
      throw new Error(message)
    }
    return data
  },
  async resolvePaypal(id, values) {
    if (demoMode) { demo.paypal = demo.paypal.filter((row) => row.id !== id); return delay(true) }
    return check(await supabase.from('paypal_transactions').update(values).eq('id', id))
  },
  async rememberSender(email, client_id) {
    if (demoMode || !email || !client_id) return
    check(await supabase.from('paypal_senders').upsert({ email, client_id: Number(client_id) }, { onConflict: 'user_id,email' }))
  },
}

let demoProfile = { id: 'demo', display_name: 'Razz', avatar: null, email: 'razz@ripple-edit.com' }
