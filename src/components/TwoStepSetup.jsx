import { useEffect, useState } from 'react'
import { auth } from '../lib/api.js'

// Two-step login in "Your profile": scan a QR code once, confirm with a code, done.
export default function TwoStepSetup({ demo }) {
  const [factor, setFactor] = useState(undefined) // undefined while checking, null when not set up
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [state, setState] = useState('')

  useEffect(() => {
    if (demo) { setFactor(null); return }
    auth.factors().then((list) => setFactor(list.find((item) => item.status === 'verified') || null)).catch(() => setFactor(null))
  }, [demo])

  const start = async () => {
    setState('')
    try { setSetup(await auth.enroll()) } catch (err) { setState(err.message || 'Could not start the setup.') }
  }
  const confirm = async () => {
    setState('Checking…')
    try {
      await auth.verify(setup.id, code)
      setFactor({ id: setup.id, status: 'verified' })
      setSetup(null)
      setState('Two-step login is on.')
    } catch {
      setState('That code did not work. Try the newest one.')
    }
    setCode('')
  }

  return <div className="field two-step">
    <span className="field-label">Two-step login</span>
    {factor === undefined ? <span className="field-hint">Checking…</span>
      : factor ? <span className="two-step-row"><span className="status s-paid"><i/>On</span><span className="field-hint">A code from your authenticator app is asked after your password.</span></span>
        : setup ? <div className="two-step-setup">
          <img className="two-step-qr" src={setup.qr} alt="QR code for your authenticator app" width="164" height="164"/>
          <div className="two-step-steps">
            <span className="field-hint">1. Scan this with your authenticator app (Google Authenticator, 1Password, Authy). Can't scan? Enter this key instead: <code>{setup.secret}</code></span>
            <span className="field-hint">2. Type the 6-digit code it shows:</span>
            <span className="inline-new">
              <input className="input input--mono" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}/>
              <button type="button" className="button button--small" disabled={code.length !== 6} onClick={confirm}>Turn on</button>
            </span>
          </div>
        </div>
          : demo ? <span className="field-hint">Available when signed in to the live studio.</span>
            : <span className="two-step-row"><button type="button" className="button button--small" onClick={start}>Set up</button><span className="field-hint">Recommended: your business data is online.</span></span>}
    {state && <span className="field-hint">{state}</span>}
  </div>
}
