import { useState } from 'react'
import { auth } from '../lib/api.js'
import { Brand } from '../components/Shell.jsx'

export default function Login({ onSignedIn, demo }) {
  const [email, setEmail] = useState(demo ? 'razz@ripple-edit.com' : '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await auth.signIn(email, password); onSignedIn(result.session || result) }
    catch (err) { setError(err.message || 'That login did not work.') }
    finally { setBusy(false) }
  }
  return <main className="signin">
    <div className="signin-inner">
      <Brand className="signin-brand"/>
      <form onSubmit={submit}>
        <label className="field"><span className="field-label">Email</span><input className="input" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)}/></label>
        <label className="field"><span className="field-label">Password</span><input className="input" type="password" autoComplete="current-password" required={!demo} value={password} onChange={(event) => setPassword(event.target.value)}/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--solid" disabled={busy}>{busy ? 'Signing in…' : demo ? 'Open the demo' : 'Sign in'}</button>
      </form>
      {demo && <p className="signin-foot">Demo mode · sample data, nothing is saved.</p>}
    </div>
  </main>
}
