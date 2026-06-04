import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, Spinner, RoleBadge } from '../components/UI'
import { Users, Search, Shield } from 'lucide-react'

const ROLES = ['viewer', 'staff', 'custodian', 'supply_officer', 'admin']
const ROLE_LABELS = { viewer: 'Viewer', staff: 'Student / Staff', custodian: 'Room Custodian', supply_officer: 'Supply Officer', admin: 'Administrator' }
const ROLE_DESCRIPTIONS = {
  viewer: 'View, search, and export inventory only',
  staff: 'Submit requests and view inventory',
  custodian: 'Add/edit inventory for assigned rooms',
  supply_officer: 'Manage Central Supply, approve/release requests, view audit log',
  admin: 'Full access, delete/restore records, manage users, all audit logs',
}

export default function UsersPage() {
  const { profile: currentProfile } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: usersData }, { data: roomsData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('rooms').select('*').order('floor').order('name'),
    ])
    setUsers(usersData || [])
    setRooms(roomsData || [])
    setLoading(false)
  }

  async function updateUser(userId, updates, oldUser) {
    const { error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', userId)
    if (error) { toast(error.message, 'error'); return }
    await logAudit({ action_type: 'Edited', record_type: 'User', record_id: userId, record_label: oldUser.full_name, old_value: { role: oldUser.role, assigned_rooms: oldUser.assigned_rooms }, new_value: updates, profile: currentProfile })
    toast('User updated', 'success')
    setEditingUser(null)
    loadAll()
  }

  const filtered = users.filter(u => !search || [u.full_name, u.email].some(v => v.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="main">
      <div className="page-header">
        <div><div className="page-title">User Management</div><div className="page-subtitle">Manage roles and permissions</div></div>
      </div>

      {/* Role reference */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={14} style={{ color: 'var(--teal)' }} /> Role Permissions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {ROLES.map(r => (
            <div key={r} style={{ borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px' }}>
              <RoleBadge role={r} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{ROLE_DESCRIPTIONS[r]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box"><Search size={14} className="search-icon" /><input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Assigned Rooms</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--teal-dark)', flexShrink: 0 }}>
                          {user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{user.full_name}</span>
                        {user.id === currentProfile?.id && <span className="badge" style={{ background: 'var(--teal-pale)', color: 'var(--teal-dark)', fontSize: 10 }}>You</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text3)' }}>{user.email}</td>
                    <td><RoleBadge role={user.role} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {user.role === 'custodian'
                        ? (user.assigned_rooms?.length > 0
                            ? user.assigned_rooms.map(code => rooms.find(r => r.code === code)?.abbreviation || code).join(', ')
                            : <span style={{ color: 'var(--danger)', fontSize: 11 }}>No rooms assigned</span>)
                        : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                      }
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{user.created_at?.split('T')[0]}</td>
                    <td>
                      {user.id !== currentProfile?.id && (
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingUser(user)}>Edit Role</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">{filtered.length} users</div>
        </div>
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          rooms={rooms}
          onClose={() => setEditingUser(null)}
          onSave={(updates) => updateUser(editingUser.id, updates, editingUser)}
        />
      )}
    </div>
  )
}

function EditUserModal({ user, rooms, onClose, onSave }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState(user.role)
  const [assignedRooms, setAssignedRooms] = useState(user.assigned_rooms || [])

  function toggleRoom(code) {
    setAssignedRooms(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
  }

  async function handleSave() {
    setLoading(true)
    await onSave({ role, assigned_rooms: role === 'custodian' ? assignedRooms : [] })
    setLoading(false)
  }

  return (
    <Modal title={`Edit Role — ${user.full_name}`} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Update Role'}</button></>}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>
          {user.email}
        </div>
        <div className="form-field">
          <label className="form-label">Role</label>
          <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{ROLE_DESCRIPTIONS[role]}</div>
        </div>
      </div>

      {role === 'custodian' && (
        <div className="form-field">
          <label className="form-label">Assigned Rooms (custodian can only edit these)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 6 }}>
            {rooms.map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${assignedRooms.includes(r.code) ? 'var(--teal)' : 'var(--border)'}`, background: assignedRooms.includes(r.code) ? 'var(--teal-pale)' : 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={assignedRooms.includes(r.code)} onChange={() => toggleRoom(r.code)} style={{ accentColor: 'var(--teal)' }} />
                <span>{r.abbreviation} <span style={{ fontSize: 11, color: 'var(--text3)' }}>({r.floor})</span></span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
