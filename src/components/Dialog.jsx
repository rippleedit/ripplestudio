import { useEffect, useRef } from 'react'
import Icon from '../lib/icons.jsx'

export default function Dialog({ title, children, onClose, footer, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    if (node && !node.open) node.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog--wide' : ''}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClose={onClose}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="dialog-inner">
        <div className="dialog-head"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><Icon name="close"/></button></div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </dialog>
  )
}
