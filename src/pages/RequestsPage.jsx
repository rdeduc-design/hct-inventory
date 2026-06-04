import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, StatusBadge, Spinner, EmptyState, ConfirmDialog } from '../components/UI'
import { Plus, Search, Trash2, RotateCcw } from 'lucide-react'

export default function RequestsPage() {
  const { profile, perms } = useAuth()
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingReq, setEditingReq] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadRequests() }, [showDeleted])

  async function loadRequests() {
    setLoading(true)
    let q = supabase.from('requests').select('*, profiles!submitted_by(full_name), reviewer:profiles!reviewed_by(full_name)').order('created_at', { ascending: false })
    if (!showDeleted) q = q.eq('is_deleted', false)
    const { data } = await q
    setRequests(data || [])
    setLoading(false)
  }

  function getFiltered() {
    let out = [...requests]
    if (search) out = out.filter(r => [r.requester_name, r.item_name, r.department || ''].some(v => v.toLowerCase().includes(search.toLowerCase())))
    if (filterStatus !== 'all') out = out.filter(r => r.status === filterStatus)
    if (filterPriority !== 'all') out = out.filter(r => r.priority === filterPriority)
    return out
  }

  async function updateStatus(req, status) {
    const { error } = await supabase.from('requests').update({ status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', req.id)
    if (error) { toast(error.message, 'error'); return }
    const actionMap = { Approved: 'Approved', Released: 'Released', Denied: 'Denied' }
    await logAudit({ action_type: actionMap[status] || 'Edited', record_type: 'Request', record_id: req.id, record_label: req.item_name, old_value: { status: req.status }, new_value: { status }, profile })
    toast(`Request ${status.toLowerCase()}`, 'success')
    loadRequests()
  }

  async function softDelete(req) {
    await supabase.from('requests').update({ is_deleted: true, deleted_by: profile?.id, deleted_at: new Date().toISOString() }).eq('id', req.id)
    await logAudit({ action_type: 'Deleted', record_type: 'Request', record_id: req.id, record_label: req.item_name, profile })
    toast('Request moved to trash', 'info')
    setConfirmDelete(null)
    loadRequests()
  }

  async function restoreReq(req) {
    await supabase.from('requests').update({ is_deleted: false, deleted_by: null, deleted_at: null }).eq('id', req.id)
    await logAudit({ action_type: 'Restored', record_type: 'Request', record_id: req.id, record_label: req.item_name, profile })
    toast('Request restored', 'success')
    loadRequests()
  }

  const filtered = getFiltered()
  const counts = { Pending: 0, Approved: 0, Released: 0, Denied: 0, Returned: 0 }
  requests.filter(r => !r.is_deleted).forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++ })

  return (
    <div className="main">
      <div className="page-header">
        <div><div className="page-title">Request Management</div><div className="page-subtitle">Equipment and supply requests</div></div>
        {perms?.canSubmitRequest && <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={14} /> New Request</button>}
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {Object.entries(counts).map(([s, n]) => (
          <div key={s} className={`stat-card ${s === 'Pending' ? 'navy' : s === 'Approved' ? 'teal' : ''}`}>
            <div className="sc-label">{s}</div><div className="sc-val">{n}</div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div className="search-box"><Search size={14} className="search-icon" /><input placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="form-select" style={{ height: 36, width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {REQUEST_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{ height: 36, width: 'auto' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All Priorities</option>
          {REQUEST_PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        {perms?.canDelete && (
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-outline'}`} onClick={() => setShowDeleted(!showDeleted)}>
            <Trash2 size={12} /> {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
          </button>
        )}
      </div>

      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item / Department</th>
                  <th>Requester</th>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="📋" message="No requests found." /></td></tr>
                ) : filtered.map(req => (
                  <tr key={req.id} style={{ opacity: req.is_deleted ? 0.5 : 1, background: req.is_deleted ? '#fef2f2' : undefined }}>
                    <td>
                      <strong style={{ fontSize: 13 }}>{req.item_name}</strong>
                      {req.is_deleted && <span className="badge badge-not-functional" style={{ marginLeft: 6, fontSize: 10 }}>Deleted</span>}
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{req.department || '—'}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{req.requester_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{req.date_requested}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{req.quantity}</td>
                    <td><StatusBadge status={req.priority} /></td>
                    <td>
                      {perms?.canApproveRequests && !req.is_deleted ? (
                        <select className="form-select" style={{ height: 28, fontSize: 12, width: 'auto' }} value={req.status} onChange={e => updateStatus(req, e.target.value)}>
                          {REQUEST_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : <StatusBadge status={req.status} />}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!req.is_deleted && (perms?.canSubmitRequest || perms?.canApproveRequests) && (
                          <button className="btn btn-outline btn-xs" onClick={() => setEditingReq(req)}>Edit</button>
                        )}
                        {!req.is_deleted && perms?.canDelete && (
                          <button className="btn btn-danger btn-xs" onClick={() => setConfirmDelete(req)}><Trash2 size={12} /></button>
                        )}
                        {req.is_deleted && perms?.canDelete && (
                          <button className="btn btn-outline btn-xs" onClick={() => restoreReq(req)}><RotateCcw size={12} /> Restore</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">{filtered.length} of {requests.filter(r => showDeleted || !r.is_deleted).length} requests shown</div>
        </div>
      )}

      {(modalOpen || editingReq) && (
        <RequestFormModal
          req={editingReq}
          profile={profile}
          onClose={() => { setModalOpen(false); setEditingReq(null) }}
          onSave={() => { setModalOpen(false); setEditingReq(null); loadRequests() }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog title="Delete Request" message={`Soft-delete request for "${confirmDelete.item_name}"? It can be restored.`} onConfirm={() => softDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} danger />
      )}
    </div>
  )
}

function RequestFormModal({ req, profile, onClose, onSave }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    requester_name: req?.requester_name || profile?.full_name || '',
    department: req?.department || '',
    date_requested: req?.date_requested || new Date().toISOString().split('T')[0],
    item_name: req?.item_name || '',
    quantity: req?.quantity || 1,
    reason: req?.reason || '',
    priority: req?.priority || 'Medium',
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    if (!form.requester_name || !form.item_name) { toast('Name and item are required', 'error'); return }
    setLoading(true)
    try {
      const now = new Date().toISOString()
      if (req) {
        await supabase.from('requests').update({ ...form, quantity: parseInt(form.quantity), updated_at: now }).eq('id', req.id)
        await logAudit({ action_type: 'Edited', record_type: 'Request', record_id: req.id, record_label: form.item_name, old_value: { item_name: req.item_name }, new_value: form, profile })
        toast('Request updated', 'success')
      } else {
        const { data } = await supabase.from('requests').insert({ ...form, quantity: parseInt(form.quantity), submitted_by: profile?.id, created_at: now, updated_at: now }).select().single()
        await logAudit({ action_type: 'Created', record_type: 'Request', record_id: data?.id, record_label: form.item_name, new_value: form, profile })
        toast('Request submitted', 'success')
      }
      onSave()
    } catch (err) { toast(err.message, 'error') } finally { setLoading(false) }
  }

  return (
    <Modal title={req ? 'Edit Request' : 'New Request'} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : req ? 'Update' : 'Submit Request'}</button></>}
    >
      <div className="form-grid">
        <div className="form-field"><label className="form-label">Requester Name *</label><input className="form-input" value={form.requester_name} onChange={set('requester_name')} /></div>
        <div className="form-field"><label className="form-label">Department / Program</label><input className="form-input" placeholder="e.g. Nursing Department" value={form.department} onChange={set('department')} /></div>
        <div className="form-field"><label className="form-label">Date Requested</label><input className="form-input" type="date" value={form.date_requested} onChange={set('date_requested')} /></div>
        <div className="form-field"><label className="form-label">Item Requested *</label><input className="form-input" value={form.item_name} onChange={set('item_name')} /></div>
        <div className="form-field"><label className="form-label">Quantity</label><input className="form-input" type="number" min="1" value={form.quantity} onChange={set('quantity')} /></div>
        <div className="form-field">
          <label className="form-label">Priority</label>
          <select className="form-select" value={form.priority} onChange={set('priority')}>{REQUEST_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
        </div>
        <div className="form-field full"><label className="form-label">Reason for Request</label><textarea className="form-textarea" placeholder="Explain why this item is needed..." value={form.reason} onChange={set('reason')} /></div>
      </div>
    </Modal>
  )
}
