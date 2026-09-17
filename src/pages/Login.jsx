import { useState } from 'react'
import { auth } from '../lib/api.js'
import { Brand } from '../components/Shell.jsx'

// After the password: the current code from the authenticator app.
function CodeStep({ onSignOut }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const factor = (await auth.factors()).find((item) => item.status === 'verified')
      if (!factor) throw new Error('No authenticator is set up for this login.')
      await auth.verify(factor.id, code)
      // Supabase now issues a fully verified session; the app picks it up by itself.
    } catch (err) {
      setError(/invalid|expired/i.test(err.message || '') ? 'That code did not work. Try the newest one.' : (err.message || 'That code did not work.'))
      setCode('')
      setBusy(false)
    }
  }
  return <main className="signin">
    <div className="signin-inner">
      <Brand className="signin-brand"/>
      <form onSubmit={submit}>
        <label className="field"><span className="field-label">Code from your authenticator app</span><input className="input input--mono" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--solid" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Continue'}</button>
      </form>
      <p className="signin-foot"><button type="button" className="text-button" onClick={onSignOut}>Use a different login</button></p>
    </div>
  </main>
}

// The password and the code are separate steps, each with its own state.
export default function Login({ mode = 'password', onSignOut, ...props }) {
  return mode === 'code' ? <CodeStep onSignOut={onSignOut}/> : <PasswordStep {...props}/>
}

function PasswordStep({ onSignedIn, demo }) {
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
