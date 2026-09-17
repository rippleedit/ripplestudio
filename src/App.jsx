import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api, auth, demoMode } from './lib/api.js'
import { byLane, isOpen } from './lib/projects.js'
import Shell from './components/Shell.jsx'
import ActiveTimer from './components/ActiveTimer.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import Time from './pages/Time.jsx'
import Clients from './pages/Clients.jsx'
import Finance from './pages/Finance.jsx'
import Login from './pages/Login.jsx'
import { registerClients, Spinner } from './components/UI.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [data, setData] = useState(null)
  const [profile, setProfile] = useState(null)
  const [needsCode, setNeedsCode] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setError(''); setData(await api.loadAll()) }
    catch (err) { setError(err.message || 'Could not load the workspace.') }
  }, [])

  useEffect(() => {
    auth.session().then(setSession)
    return auth.onChange(setSession)
  }, [])
  // Two-step login: once an authenticator is set up, a password alone does not open the studio.
  useEffect(() => {
    if (!session) { setNeedsCode(null); return }
    auth.assurance().then(({ current, next }) => setNeedsCode(next === 'aal2' && current !== 'aal2')).catch(() => setNeedsCode(false))
  }, [session])
  useEffect(() => { if (session && needsCode === false) load(); else setData(null) }, [session, needsCode, load])

  // PayPal is checked quietly in the background whenever you open Studio, at most every ten minutes.
  useEffect(() => {
    if (!session || demoMode || needsCode !== false) return
    try {
      if (Date.now() - Number(localStorage.getItem('paypal-checked') || 0) < 10 * 60000) return
      localStorage.setItem('paypal-checked', String(Date.now()))
    } catch { /* storage blocked: check anyway */ }
    api.syncPaypal().then((result) => { if (result?.added || result?.recognised) load() }).catch(() => {})
  }, [session, needsCode, load])
  useEffect(() => {
    if (!session) { setProfile(null); return }
    api.profile().then(setProfile).catch(() => setProfile({ display_name: 'Razz', avatar: null, email: session.user?.email }))
  }, [session])

  const saveProfile = useCallback(async (values) => setProfile(await api.saveProfile(values)), [])
  const signOut = useCallback(async () => { await auth.signOut(); setSession(null) }, [])

  const actions = useMemo(() => ({
    refresh: load,
    async createClient(values) { const row = await api.createClient(values); await load(); return row },
    async updateClient(id, values) { await api.updateClient(id, values); await load() },
    async deleteClient(id) { await api.deleteClient(id); await load() },
    async createProject(values) { const row = await api.createProject(values); await load(); return row },
    async updateProject(id, values) { await api.updateProject(id, values); await load() },
    async deleteProject(id) { await api.deleteProject(id); await load() },
    async savePayment(values, id) { await api.savePayment(values, id); await load() },
    async deletePayment(id) { await api.deletePayment(id); await load() },
    async startTimer(projectId, stage, item) { await api.startTimer(projectId, stage, item); await load() },
    async updateTimer(id, values) { await api.updateTimer(id, values); await load() },
    async stopTimer(id, seconds) { await api.updateTimer(id, { ended_at: new Date().toISOString(), duration_seconds: seconds, paused_at: null }); await load() },
    async addTime(values) { await api.addTime(values); await load() },
    async syncPaypal() { const result = await api.syncPaypal(); await load(); return result },
    async matchPaypal(item, values) {
      const saved = await api.savePayment(values)
      await api.resolvePaypal(item.id, { status: 'matched', payment_id: saved.id })
      await api.rememberSender(item.payer_email, values.client_id)
      await load()
    },
    async dismissPaypal(id) { await api.resolvePaypal(id, { status: 'dismissed' }); await load() },
  }), [load])

  const counts = useMemo(() => {
    if (!data) return {}
    const waiting = byLane(data.projects).you.length
    return { '/': { value: waiting, lit: waiting > 0 }, '/projects': { value: data.projects.filter(isOpen).length }, '/finance': { value: data.paypal?.length || 0, lit: true } }
  }, [data])

  if (session === undefined) return <div className="signin"><Spinner label="Opening RippleStudio"/></div>
  if (!session) return <Login onSignedIn={(next) => setSession(next)} demo={demoMode}/>
  if (needsCode === null) return <div className="signin"><Spinner label="Opening RippleStudio"/></div>
  if (needsCode) return <Login mode="code" onSignOut={signOut}/>
  if (!data) return <div className="signin">{error ? <p className="form-error">{error}</p> : <Spinner label="Loading your studio"/>}</div>

  registerClients(data.clients)
  const activeTimer = data.time_entries.find((entry) => !entry.ended_at)
  const activeProject = data.projects.find((project) => Number(project.id) === Number(activeTimer?.project_id))

  return <Shell demo={demoMode} counts={counts} profile={profile} onSaveProfile={saveProfile} onSignOut={signOut}>
    {error && <p className="page form-error">{error}</p>}
    <Routes>
      <Route path="/" element={<Home data={data} actions={actions} profile={profile}/>} />
      <Route path="/projects" element={<Projects data={data} actions={actions}/>} />
      <Route path="/time" element={<Time data={data} actions={actions} activeTimer={activeTimer}/>} />
      <Route path="/clients" element={<Clients data={data} actions={actions}/>} />
      <Route path="/finance" element={<Finance data={data} actions={actions}/>} />
      <Route path="*" element={<Navigate to="/" replace/>} />
    </Routes>
    <ActiveTimer timer={activeTimer} project={activeProject} onUpdate={(values) => actions.updateTimer(activeTimer.id, values)} onStop={(seconds) => actions.stopTimer(activeTimer.id, seconds)}/>
  </Shell>
}
