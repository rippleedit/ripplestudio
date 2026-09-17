import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Icon from '../lib/icons.jsx'
import ProfileDialog from './ProfileDialog.jsx'
import { Avatar } from './UI.jsx'

const links = [
  ['/', 'Home', 'home'],
  ['/projects', 'Projects', 'projects'],
  ['/time', 'Time', 'clock'],
  ['/clients', 'Clients', 'users'],
  ['/finance', 'Finance', 'wallet'],
]

export function Brand({ className = 'side-brand' }) {
  return <div className={className}>
    <img className="brand-logo" src="/logotype.png" width="104" height="24" alt="RippleEdit"/>
    <span className="brand-dot"/>
    <span className="brand-product">Studio</span>
  </div>
}

export default function Shell({ children, counts = {}, profile, onSaveProfile, onSignOut, demo }) {
  const [menu, setMenu] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const { pathname } = useLocation()
  const current = links.find(([to]) => (to === '/' ? pathname === '/' : pathname.startsWith(to)))
  const name = profile?.display_name || 'Razz'

  useEffect(() => {
    setMenu(false)
    document.getElementById('main')?.scrollTo(0, 0)
  }, [pathname])

  return <div className={`app ${menu ? 'is-menu-open' : ''}`}>
    <aside className="sidebar">
      <Brand/>
      <nav className="side-nav">
        <div className="side-kicker">Workspace</div>
        {links.map(([to, label, icon]) => {
          const count = counts[to]
          return <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            <Icon name={icon}/>
            <span>{label}</span>
            {count?.value ? <span className={`side-count ${count.lit ? 'is-lit' : ''}`}>{count.value}</span> : null}
          </NavLink>
        })}
      </nav>
      {/* The studio signs itself here, as in RippleReview. */}
      <button className="side-foot" type="button" onClick={() => setEditingProfile(true)} title="Your profile">
        <Avatar name={name} src={profile?.avatar || null} tint="#ff3d17"/>
        <span className="side-me">
          <span className="side-me-line"><strong>{name}</strong><span className="tag tag--admin tag--mini">Admin</span></span>
          <span className="side-org">{demo ? 'Demo workspace' : '@ RippleEdit'}</span>
        </span>
        <Icon name="settings" size={16} className="side-foot-icon"/>
      </button>
    </aside>
    {menu && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <div className="app-main">
      <header className="app-bar">
        <button className="icon-button app-menu" type="button" onClick={() => setMenu(true)} aria-label="Open navigation"><Icon name="menu"/></button>
        <div className="crumbs"><span>Studio</span><i>/</i><span>{current?.[1] || 'Home'}</span></div>
      </header>
      <main className="app-scroll" id="main">{children}</main>
    </div>
    {editingProfile && <ProfileDialog profile={profile} demo={demo} onSave={onSaveProfile} onSignOut={onSignOut} onClose={() => setEditingProfile(false)}/>}
  </div>
}
