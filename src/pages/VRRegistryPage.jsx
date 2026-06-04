import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { STATUSES } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, ConfirmDialog, StatusBadge, Spinner, EmptyState, QRModal } from '../components/UI'
import { generateItemQR, generateAssetTag } from '../lib/qr'
import { Plus, Search, QrCode, Trash2, RotateCcw } from 'lucide-react'

export default function VRRegistryPage() {
  const { profile, perms } = useAuth()
  const toast = useToast()
  const [assets, setAssets] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [modalAsset, setModalAsset] = useState(null)
  const [editingAsset, setEditingAsset] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [qrModal, setQrModal] = useState(null)

  useEffect(() => { loadAll() }, [showDeleted])

  async function loadAll() {
    setLoading(true)
    const [{ data: assetData }, { data: roomData }] = await Promise.all([
      supabase.from('vr_assets').select('*, rooms(name, floor, code)').eq('is_deleted', false).or(showDeleted ? 'is_deleted.eq.true,is_deleted.eq.false' : 'is_deleted.eq.false').order('vr_number'),
      supabase.from('rooms').select('*').order('floor').order('name'),
    ])
    setAssets(assetData || [])
    setRooms(roomData || [])
    setLoading(false)
  }

  const canEdit = perms?.canManageSupply || false

  function getFiltered() {
    let out = [...assets]
    if (search) out = out.filter(a => [a.vr_number, a.serial_number || '', a.brand || '', a.model || ''].some(v => v.toLowerCase().includes(search.toLowerCase())))
    if (filterStatus !== 'all') out = out.filter(a => a.status === filterStatus)
    return out
  }

  async function showQR(asset) {
    const fakeItem = { id: asset.id, name: asset.vr_number, asset_tag: asset.asset_tag }
    const qrData = await generateItemQR(fakeItem, 'vr-registry')
    setQrModal({ url: qrData, info: { 'VR Number': asset.vr_number, 'Brand/Model': `${asset.brand} ${asset.model}`, 'Serial': asset.serial_number || 'N/A', 'Status': asset.status } })
  }

  async function saveAsset(formData) {
    const { data, error } = await supabase.from('vr_assets').insert({ ...formData, created_by: profile?.id, updated_by: profile?.id }).select().single()
    if (error) { toast(error.message, 'error'); return }
    await logAudit({ action_type: 'Created', record_type: 'VR Asset', record_id: data.id, record_label: formData.vr_number, new_value: formData, profile })
    toast('VR asset added', 'success')
    setModalAsset(null)
    loadAll()
  }

  async function updateAsset(id, formData, oldAsset) {
    const { error } = await supabase.from('vr_assets').update({ ...formData, updated_by: profile?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    await logAudit({ action_type: 'Edited', record_type: 'VR Asset', record_id: id, record_label: formData.vr_number, old_value: { status: oldAsset.status }, new_value: { status: formData.status }, profile })
    toast('VR asset updated', 'success')
    setEditingAsset(null)
    loadAll()
  }

  async function softDelete(asset) {
    await supabase.from('vr_assets').update({ is_deleted: true, deleted_by: profile?.id, deleted_at: new Date().toISOString() }).eq('id', asset.id)
    await logAudit({ action_type: 'Deleted', record_type: 'VR Asset', record_id: asset.id, record_label: asset.vr_number, profile })
    toast('VR asset moved to trash', 'info')
    setConfirmDelete(null)
    loadAll()
  }

  async function restoreAsset(asset) {
    await supabase.from('vr_assets').update({ is_deleted: false, deleted_by: null, deleted_at: null }).eq('id', asset.id)
    await logAudit({ action_type: 'Restored', record_type: 'VR Asset', record_id: asset.id, record_label: asset.vr_number, profile })
    toast('VR asset restored', 'success')
    loadAll()
  }

  const filtered = getFiltered()

  return (
    <div className="main">
      <div className="page-header">
        <div><div className="page-title">VR Asset Registry</div><div className="page-subtitle">Virtual Reality headset tracking and management</div></div>
        {canEdit && <button className="btn btn-primary" onClick={() => setModalAsset({})}><Plus size={14} /> Add VR Asset</button>}
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card navy"><div className="sc-label">Total Headsets</div><div className="sc-val">{assets.filter(a => !a.is_deleted).length}</div></div>
        <div className="stat-card teal"><div className="sc-label">Functional</div><div className="sc-val">{assets.filter(a => !a.is_deleted && a.status === 'Functional').length}</div></div>
        <div className="stat-card"><div className="sc-label">Under Repair</div><div className="sc-val">{assets.filter(a => !a.is_deleted && a.status === 'Under Repair').length}</div></div>
        <div className="stat-card"><div className="sc-label">Not Functional</div><div className="sc-val">{assets.filter(a => !a.is_deleted && a.status === 'Not Functional').length}</div></div>
      </div>

      <div className="toolbar">
        <div className="search-box"><Search size={14} className="search-icon" /><input placeholder="Search by VR number, serial, brand, or model..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="form-select" style={{ height: 36, width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {perms?.canDelete && (
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-outline'}`} onClick={() => setShowDeleted(!showDeleted)}>
            <Trash2 size={12} /> {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
          </button>
        )}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon="🥽" message="No VR assets found." action={canEdit && <button className="btn btn-primary" onClick={() => setModalAsset({})}>Add First Asset</button>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(asset => (
            <div key={asset.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: `1px solid ${asset.is_deleted ? '#fca5a5' : 'var(--border)'}`, padding: 16, display: 'flex', alignItems: 'center', gap: 16, opacity: asset.is_deleted ? 0.6 : 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--teal)', flexShrink: 0, fontFamily: 'DM Mono, monospace' }}>
                {asset.vr_number}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{asset.brand} {asset.model}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>SN: <span style={{ fontFamily: 'DM Mono, monospace' }}>{asset.serial_number || '—'}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <StatusBadge status={asset.status} />
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{asset.rooms?.name || '—'} {asset.rooms?.floor ? `· ${asset.rooms.floor}` : ''}</span>
                  {asset.is_deleted && <span className="badge badge-not-functional" style={{ fontSize: 10 }}>Deleted</span>}
                </div>
                {asset.notes && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{asset.notes}</div>}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text3)' }}>
                <div>Last Maintenance</div>
                <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{asset.last_maintenance || 'N/A'}</div>
                {asset.asset_tag && <div style={{ fontFamily: 'DM Mono, monospace', color: 'var(--teal-dark)', fontWeight: 600, marginTop: 4 }}>{asset.asset_tag}</div>}
                <div style={{ display: 'flex', gap: 5, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => showQR(asset)}><QrCode size={12} /></button>
                  {!asset.is_deleted && canEdit && <button className="btn btn-outline btn-xs" onClick={() => setEditingAsset(asset)}>Edit</button>}
                  {!asset.is_deleted && perms?.canDelete && <button className="btn btn-danger btn-xs" onClick={() => setConfirmDelete(asset)}><Trash2 size={12} /></button>}
                  {asset.is_deleted && perms?.canDelete && <button className="btn btn-outline btn-xs" onClick={() => restoreAsset(asset)}><RotateCcw size={12} /> Restore</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modalAsset !== null || editingAsset) && (
        <VRFormModal
          asset={editingAsset}
          rooms={rooms}
          assets={assets}
          onClose={() => { setModalAsset(null); setEditingAsset(null) }}
          onSave={editingAsset ? (data) => updateAsset(editingAsset.id, data, editingAsset) : saveAsset}
        />
      )}
      {confirmDelete && <ConfirmDialog title="Delete VR Asset" message={`Soft-delete ${confirmDelete.vr_number}?`} onConfirm={() => softDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} danger />}
      {qrModal && <QRModal title="VR Asset QR" qrUrl={qrModal.url} itemInfo={qrModal.info} onClose={() => setQrModal(null)} />}
    </div>
  )
}

function VRFormModal({ asset, rooms, assets, onClose, onSave }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const nextNum = `VR-${String(assets.filter(a => !a.is_deleted).length + 1).padStart(3, '0')}`
  const [form, setForm] = useState({
    vr_number: asset?.vr_number || nextNum,
    serial_number: asset?.serial_number || '',
    brand: asset?.brand || '',
    model: asset?.model || '',
    room_id: asset?.room_id || '',
    status: asset?.status || 'Functional',
    last_maintenance: asset?.last_maintenance || '',
    asset_tag: asset?.asset_tag || '',
    notes: asset?.notes || '',
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    if (!form.vr_number) { toast('VR Number required', 'error'); return }
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <Modal title={asset ? 'Edit VR Asset' : 'Add VR Asset'} onClose={onClose}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : asset ? 'Update' : 'Add Asset'}</button></>}
    >
      <div className="form-grid">
        <div className="form-field"><label className="form-label">VR Number *</label><input className="form-input" style={{ fontFamily: 'DM Mono, monospace' }} value={form.vr_number} onChange={set('vr_number')} /></div>
        <div className="form-field"><label className="form-label">Serial Number</label><input className="form-input" style={{ fontFamily: 'DM Mono, monospace' }} value={form.serial_number} onChange={set('serial_number')} /></div>
        <div className="form-field"><label className="form-label">Brand</label><input className="form-input" placeholder="e.g. Meta" value={form.brand} onChange={set('brand')} /></div>
        <div className="form-field"><label className="form-label">Model</label><input className="form-input" placeholder="e.g. Quest 3" value={form.model} onChange={set('model')} /></div>
        <div className="form-field">
          <label className="form-label">Assigned Room</label>
          <select className="form-select" value={form.room_id} onChange={set('room_id')}>
            <option value="">— Select room —</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.floor})</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="form-field"><label className="form-label">Last Maintenance</label><input className="form-input" type="date" value={form.last_maintenance} onChange={set('last_maintenance')} /></div>
        <div className="form-field"><label className="form-label">Asset Tag</label><input className="form-input" style={{ fontFamily: 'DM Mono, monospace' }} placeholder="HCT-VR-0001" value={form.asset_tag} onChange={set('asset_tag')} /></div>
        <div className="form-field full"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={set('notes')} /></div>
      </div>
    </Modal>
  )
}
