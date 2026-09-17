import { useRef, useState } from 'react'
import Dialog from './Dialog.jsx'
import Icon from '../lib/icons.jsx'
import { squareJpeg } from './PictureField.jsx'
import { Avatar } from './UI.jsx'

// "Your profile", as in RippleReview: picture, display name, sign out.
export default function ProfileDialog({ profile, demo, onSave, onSignOut, onClose }) {
  const [name, setName] = useState(profile?.display_name || '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const file = useRef(null)
  const shown = name.trim() || 'Razz'

  const save = async () => {
    const fields = {}
    if (name.trim() && name.trim() !== profile?.display_name) fields.display_name = name.trim()
    if (avatar !== (profile?.avatar ?? null)) fields.avatar = avatar
    if (!Object.keys(fields).length) return onClose()
    setSaving(true)
    setError('')
    try {
      await onSave(fields)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
      setSaving(false)
    }
  }

  return <Dialog title="Your profile" onClose={onClose} footer={<>
    {error && <span className="form-error">{error}</span>}
    <button type="button" className="button" onClick={onClose}>Close</button>
    <button type="button" className="button button--solid" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
  </>}>
    <div className="profile-top">
      <Avatar name={shown} size="lg" src={avatar} tint="#ff3d17"/>
      <div className="profile-id">
        <strong>{shown}</strong>
        <span>{profile?.email || (demo ? 'Demo workspace' : '')}</span>
        <span className="profile-pic-actions">
          <button type="button" className="button button--small" onClick={() => file.current.click()}><Icon name="image" size={14}/>{avatar ? 'Change picture' : 'Add picture'}</button>
          {avatar && <button type="button" className="icon-button" title="Remove picture" aria-label="Remove picture" onClick={() => setAvatar(null)}><Icon name="trash" size={16}/></button>}
        </span>
      </div>
    </div>
    <input ref={file} type="file" accept="image/*" hidden onChange={async (event) => {
      const picked = event.target.files?.[0]
      event.target.value = ''
      if (!picked) return
      try { setAvatar(await squareJpeg(picked)) } catch { setError('That file could not be read as a picture.') }
    }}/>

    <label className="field">
      <span className="field-label">Display name</span>
      <input className="input" value={name} placeholder="e.g. Razz" maxLength={40} autoComplete="off" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save() }}/>
      <span className="field-hint">Shown in the sidebar and in your greeting on Home.</span>
    </label>

    <div className="sheet-divider"/>
    <button type="button" className="button button--wide" onClick={async () => { onClose(); await onSignOut() }}><Icon name="logout" size={15}/>Sign out</button>
  </Dialog>
}
