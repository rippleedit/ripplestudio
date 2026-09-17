import { useEffect, useState } from 'react'
import Icon from '../lib/icons.jsx'
import { Code, Tag } from './UI.jsx'
import { stopwatch, toDate } from '../lib/format.js'
import { pieceLabel, stageLabel } from '../lib/projects.js'

// The running timer holds the screen: work is either being timed, paused, or stopped and saved.
export default function ActiveTimer({ timer, project, onUpdate, onStop }) {
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!timer || timer.paused_at) return undefined
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [timer])
  if (!timer) return null

  const paused = Boolean(timer.paused_at)
  const end = paused ? toDate(timer.paused_at).getTime() : now
  const elapsed = Math.floor((end - toDate(timer.started_at).getTime()) / 1000) - Number(timer.paused_seconds || 0) + Number(timer.adjustment_seconds || 0)
  const run = (work) => async () => {
    if (busy) return
    setBusy(true)
    try { await work() } finally { setBusy(false) }
  }
  const toggle = () => (paused
    ? onUpdate({ paused_at: null, paused_seconds: Number(timer.paused_seconds || 0) + Math.floor((Date.now() - toDate(timer.paused_at).getTime()) / 1000) })
    : onUpdate({ paused_at: new Date().toISOString() }))
  const adjust = (delta) => onUpdate({ adjustment_seconds: Number(timer.adjustment_seconds || 0) + delta })

  return <div className="timer-overlay" role="dialog" aria-modal="true" aria-label="Timer">
    <div className="timer-panel">
      <span className={`status ${paused ? 'done' : 'attention'}`}><i className={paused ? '' : 'is-live'}/>{paused ? 'Paused' : 'Tracking'}</span>
      <div className="timer-what"><Code project={project}/><strong>{project?.title || 'Untitled project'}</strong></div>
      <p className="timer-stage">{[pieceLabel(timer.vsl_item), stageLabel(timer.stage)].filter(Boolean).join(' · ')}</p>
      <div className={`timer-clock ${paused ? 'is-paused' : ''}`}>{elapsed < 0 ? '-' : ''}{stopwatch(Math.abs(elapsed))}</div>
      <div className="timer-adjust">
        <button type="button" className="button button--small" disabled={busy} onClick={run(() => adjust(-60))}>−1 min</button>
        <button type="button" className="button button--small" disabled={busy} onClick={run(() => adjust(60))}>+1 min</button>
      </div>
      <div className="timer-actions">
        <button type="button" className="button" disabled={busy} onClick={run(toggle)}><Icon name={paused ? 'play' : 'pause'} size={15}/>{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" className="button button--solid" disabled={busy} onClick={run(() => onStop(elapsed))}><Icon name="stop" size={15}/>Stop and save</button>
      </div>
    </div>
  </div>
}
