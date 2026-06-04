import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, QrCode, ClipboardList, History, Users, LogOut, Menu, X, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { RoleBadge } from './UI'

export default function Nav() {
  const { profile, perms, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    { to: '/', label: 'Home', icon: <LayoutDashboard size={15} /> },
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
    { to: '/vr-registry', label: 'VR Registry', icon: <QrCode size={15} /> },
    { to: '/requests', label: 'Requests', icon: <ClipboardList size={15} /> },
    ...(perms?.canViewAudit ? [{ to: '/audit-log', label: 'Audit Log', icon: <History size={15} /> }] : []),
    ...(perms?.canManageUsers ? [{ to: '/admin/users', label: 'Users', icon: <Users size={15} /> }] : []),
  ]

  const active = (to) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav style={{ background: 'var(--navy)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--navy)', flexShrink: 0 }}>HCT</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, letterSpacing: '-0.2px' }}>Inventory System</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Healthcare & Technology Institute Inc.</div>
        </div>
      </Link>

      {/* Desktop links */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} className="nav-desktop">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500, textDecoration: 'none', color: active(l.to) ? '#fff' : 'rgba(255,255,255,0.65)', background: active(l.to) ? 'rgba(255,255,255,0.12)' : 'transparent', transition: 'all .15s' }}
          >{l.icon}{l.label}</Link>
        ))}
        {profile && (
          <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{profile.full_name}</div>
              <RoleBadge role={profile.role} />
            </div>
            <button onClick={handleSignOut} className="btn btn-ghost btn-icon" style={{ color: 'rgba(255,255,255,0.6)' }} title="Sign out"><LogOut size={16} /></button>
          </div>
        )}
      </div>

      {/* Mobile hamburger */}
      <button className="btn btn-ghost btn-icon" style={{ color: 'rgba(255,255,255,0.8)', display: 'none' }} onClick={() => setMobileOpen(!mobileOpen)} id="mobile-menu-btn">
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </nav>
  )
}
