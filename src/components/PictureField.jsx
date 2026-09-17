import { useRef, useState } from 'react'
import { Avatar } from './UI.jsx'

// Any photo becomes a 256px square JPEG, stored with the client like RippleReview does.
export async function squareJpeg(file, size = 256) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', 0.86)
}

// Saves straight away, so a picture never waits on the rest of the form.
export default function PictureField({ client, actions }) {
  const input = useRef(null)
  const [preview, setPreview] = useState(client.avatar || null)
  const [state, setState] = useState('')
  const save = async (avatar) => {
    setState('Saving…')
    try {
      await actions.updateClient(client.id, { avatar })
      setPreview(avatar)
      setState('')
    } catch (err) {
      setState(err.message || 'Could not save the picture.')
    }
  }
  return <div className="field span-2">
    <span className="field-label">Picture</span>
    <div className="picture-field">
      <Avatar name={client.name} size="lg" src={preview}/>
      <button type="button" className="button button--small" onClick={() => input.current.click()}>{preview ? 'Change picture' : 'Add picture'}</button>
      {preview && <button type="button" className="text-button text-button--danger" onClick={() => save(null)}>Remove</button>}
      {state && <span className="field-hint">{state}</span>}
      <input ref={input} type="file" accept="image/*" hidden onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) await save(await squareJpeg(file))
      }}/>
    </div>
  </div>
}
