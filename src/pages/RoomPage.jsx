import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { CATEGORIES, UNITS, STATUSES, getPresetItems } from '../lib/supabase'
import { generateItemQR, generateRoomQR, generateAssetTag, printLabel } from '../lib/qr'
import { useAuth } from '../context/AuthContext'
import { useToast, Modal, ConfirmDialog, StatusBadge, Spinner, EmptyState, QRModal } from '../components/UI'
import { TransactionModal, TransactionHistory } from '../components/TransactionModal'
import { Plus, Search, FileSpreadsheet, FileText, ArrowUpDown, QrCode, Tag, History, ChevronUp, ChevronDown, RotateCcw, Trash2 } from 'lucide-react'

export default function RoomPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { profile, perms } = useAuth()
  const toast = useToast()

  const [room, setRoom] = useState(null)
  const [allRooms, setAllRooms] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState(1)

  const [modalItem, setModalItem] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [txItem, setTxItem] = useState(null)
  const [txHistoryItem, setTxHistoryItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [roomQrData, setRoomQrData] = useState(null)

  useEffect(() => { loadRoom() }, [roomCode])
  useEffect(() => { if (room) loadItems() }, [room, showDeleted])

  async function loadRoom() {
    const [{ data: roomData }, { data: roomsData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('code', roomCode).single(),
      supabase.from('rooms').select('*').order('floor').order('name'),
    ])
    setRoom(roomData)
    setAllRooms(roomsData || [])
  }

  async function loadItems() {
    setLoading(true)
    let q = supabase.from('inventory_items').select('*, profiles!created_by(full_name)').eq('room_id', room.id)
    if (!showDeleted) q = q.eq('is_deleted', false)
    const { data } = await q.order('name')
    setItems(data || [])
    setLoading(false)
  }

  const canEdit = perms?.canEditRoom?.(roomCode) || false

  function getFiltered() {
    let out = [...items]
    if (search) out = out.filter(i => [i.name, i.category, i.asset_tag || ''].some(v => v.toLowerCase().includes(search.toLowerCase())))
    if (filterCat !== 'all') out = out.filter(i => i.category === filterCat)
    if (filterStatus !== 'all') out = out.filter(i => i.status === filterStatus)
    out.sort((a, b) => {
      const va = String(a[sortCol] ?? ''), vb = String(b[sortCol] ?? '')
      return va.localeCompare(vb) * sortDir
    })
    return out
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
    return sortDir === 1 ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  async function saveItem(formData) {
    const now = new Date().toISOString()
    const seq = items.filter(i => !i.is_deleted).length + 1
    const asset_tag = formData.asset_tag || generateAssetTag(roomCode, seq)

    const { data, error } = await supabase.from('inventory_items').insert({
      ...formData,
      asset_tag,
      room_id: room.id,
      created_by: profile?.id,
      created_at: now,
      updated_by: profile?.id,
      updated_at: now,
    }).select().single()
    if (error) { toast(error.message, 'error'); return }

    // Record initial stock transaction
    if (formData.quantity > 0) {
      await supabase.from('inventory_transactions').insert({
        item_id: data.id,
        transaction_type: 'Stock In',
        quantity_change: formData.quantity,
        quantity_before: 0,
        quantity_after: formData.quantity,
        from_room_id: room.id,
        notes: 'Initial stock on item creation',
        performed_by: profile?.id,
      })
    }

    await logAudit({ action_type: 'Created', record_type: 'Inventory Item', record_id: data.id, record_label: data.name, new_value: formData, profile })
    toast('Item added successfully', 'success')
    setModalItem(null)
    loadItems()
  }

  async function updateItem(id, formData, oldItem) {
    const { error } = await supabase.from('inventory_items').update({ ...formData, updated_by: profile?.id, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    await logAudit({ action_type: 'Edited', record_type: 'Inventory Item', record_id: id, record_label: formData.name, old_value: { name: oldItem.name, status: oldItem.status, quantity: oldItem.quantity }, new_value: { name: formData.name, status: formData.status, quantity: formData.quantity }, profile })
    toast('Item updated', 'success')
    setEditingItem(null)
    loadItems()
  }

  async function softDelete(item) {
    const { error } = await supabase.from('inventory_items').update({ is_deleted: true, deleted_by: profile?.id, deleted_at: new Date().toISOString() }).eq('id', item.id)
    if (error) { toast(error.message, 'error'); return }
    await logAudit({ action_type: 'Deleted', record_type: 'Inventory Item', record_id: item.id, record_label: item.name, old_value: { is_deleted: false }, new_value: { is_deleted: true }, profile })
    toast('Item moved to trash. It can be restored.', 'info')
    setConfirmDelete(null)
    loadItems()
  }

  async function restoreItem(item) {
    await supabase.from('inventory_items').update({ is_deleted: false, deleted_by: null, deleted_at: null }).eq('id', item.id)
    await logAudit({ action_type: 'Restored', record_type: 'Inventory Item', record_id: item.id, record_label: item.name, profile })
    toast('Item restored', 'success')
    loadItems()
  }

  async function showQR(item) {
    const qrData = await generateItemQR(item, roomCode)
    setQrModal({ url: qrData, info: { 'Item': item.name, 'Asset Tag': item.asset_tag || 'N/A', 'Category': item.category, 'Status': item.status, 'Room': room.name }, printFn: () => printLabel(item, room.name, qrData) })
  }

  async function showRoomQR() {
    const qrData = await generateRoomQR(roomCode)
    setRoomQrData(qrData)
  }

  function exportCSV() {
    const headers = ['Asset Tag', 'Name', 'Category', 'Quantity', 'Unit', 'Status', 'Location Detail', 'Remarks', 'Date Added']
    const rows = getFiltered().map(i => [i.asset_tag || '', i.name, i.category, i.quantity, i.unit, i.status, i.location_detail || '', i.remarks || '', i.created_at?.split('T')[0] || ''])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${room?.name}_inventory.csv`; a.click()
    logAudit({ action_type: 'Exported', record_type: 'Inventory Item', record_label: room?.name, notes: `${getFiltered().length} items exported`, profile })
  }

  const filtered = getFiltered()
  const floorKey = roomCode.startsWith('5th') ? '5th' : roomCode.startsWith('3rd') ? '3rd' : null

  if (loading && !room) return <div className="main"><Spinner /></div>

  return (
    <div className="main">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>›</span>
        {floorKey && <><Link to={`/floor/${floorKey}`}>{floorKey === '5th' ? '5th Floor' : '3rd Floor'}</Link><span>›</span></>}
        <span>{room?.name}</span>
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{room?.name} <span style={{ fontSize: 14, color: 'var(--teal)', fontWeight: 500 }}>({room?.abbreviation})</span></div>
          <div className="page-subtitle">{room?.floor}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={showRoomQR}><QrCode size={13} /> Room QR</button>
          {canEdit && <button className="btn btn-primary" onClick={() => setModalItem({})}><Plus size={14} /> Add Item</button>}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="stat-card navy"><div className="sc-label">Total</div><div className="sc-val">{items.filter(i => !i.is_deleted).length}</div></div>
        <div className="stat-card teal"><div className="sc-label">Functional</div><div className="sc-val">{items.filter(i => !i.is_deleted && i.status === 'Functional').length}</div></div>
        <div className="stat-card"><div className="sc-label">Not Functional</div><div className="sc-val">{items.filter(i => !i.is_deleted && i.status === 'Not Functional').length}</div></div>
        <div className="stat-card"><div className="sc-label">Under Repair</div><div className="sc-val">{items.filter(i => !i.is_deleted && i.status === 'Under Repair').length}</div></div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input placeholder="Search items, categories, asset tags..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ height: 36, width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="form-select" style={{ height: 36, width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {perms?.canDelete && (
          <button className={`btn btn-sm ${showDeleted ? 'btn-danger' : 'btn-outline'}`} onClick={() => setShowDeleted(!showDeleted)}>
            <Trash2 size={12} /> {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
          </button>
        )}
        <button className="btn btn-outline btn-sm" onClick={exportCSV}><FileSpreadsheet size={13} /> Export CSV</button>
      </div>

      {/* Table */}
      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('asset_tag')}>Asset Tag <SortIcon col="asset_tag" /></th>
                  <th onClick={() => toggleSort('name')}>Name <SortIcon col="name" /></th>
                  <th onClick={() => toggleSort('category')}>Category <SortIcon col="category" /></th>
                  <th onClick={() => toggleSort('quantity')}>Qty <SortIcon col="quantity" /></th>
                  <th onClick={() => toggleSort('status')}>Status <SortIcon col="status" /></th>
                  <th>Remarks</th>
                  <th onClick={() => toggleSort('updated_at')}>Updated <SortIcon col="updated_at" /></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}>
                    <EmptyState icon="📦" message={canEdit ? "No items found. Add your first inventory item." : "No items found in this room."} />
                  </td></tr>
                ) : filtered.map(item => (
                  <tr key={item.id} style={{ opacity: item.is_deleted ? 0.5 : 1, background: item.is_deleted ? '#fef2f2' : undefined }}>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--teal-dark)', fontWeight: 600 }}>
                      {item.asset_tag || <span style={{ color: 'var(--border2)' }}>—</span>}
                    </td>
                    <td>
                      <strong style={{ fontSize: 13 }}>{item.name}</strong>
                      {item.is_deleted && <span className="badge badge-not-functional" style={{ marginLeft: 6, fontSize: 10 }}>Deleted</span>}
                    </td>
                    <td><span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{item.category}</span></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{item.quantity} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{item.unit?.split('(')[0]}</span></td>
                    <td><StatusBadge status={item.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.remarks || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{item.updated_at?.split('T')[0]}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" title="QR Code" onClick={() => showQR(item)}><QrCode size={12} /></button>
                        <button className="btn btn-ghost btn-xs" title="Transaction History" onClick={() => setTxHistoryItem(item)}><History size={12} /></button>
                        {!item.is_deleted && canEdit && (
                          <>
                            <button className="btn btn-outline btn-xs" title="Record Transaction" onClick={() => setTxItem(item)}><ArrowUpDown size={12} /></button>
                            <button className="btn btn-outline btn-xs" onClick={() => setEditingItem(item)}>Edit</button>
                            {perms?.canDelete && <button className="btn btn-danger btn-xs" onClick={() => setConfirmDelete(item)}><Trash2 size={12} /></button>}
                          </>
                        )}
                        {item.is_deleted && perms?.canDelete && (
                          <button className="btn btn-outline btn-xs" onClick={() => restoreItem(item)}><RotateCcw size={12} /> Restore</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">{filtered.length} of {items.filter(i => showDeleted || !i.is_deleted).length} items</div>
        </div>
      )}

      {/* Modals */}
      {(modalItem !== null) && (
        <ItemFormModal
          title={`Add Item — ${room?.name}`}
          presets={getPresetItems(roomCode)}
          onClose={() => setModalItem(null)}
          onSave={saveItem}
        />
      )}
      {editingItem && (
        <ItemFormModal
          title="Edit Item"
          item={editingItem}
          presets={getPresetItems(roomCode)}
          onClose={() => setEditingItem(null)}
          onSave={(data) => updateItem(editingItem.id, data, editingItem)}
        />
      )}
      {txItem && (
        <TransactionModal item={txItem} rooms={allRooms} profile={profile} onClose={() => setTxItem(null)} onSuccess={loadItems} />
      )}
      {txHistoryItem && (
        <Modal title={`Transaction History — ${txHistoryItem.name}`} onClose={() => setTxHistoryItem(null)} size="lg" footer={<button className="btn btn-outline" onClick={() => setTxHistoryItem(null)}>Close</button>}>
          <TransactionHistory itemId={txHistoryItem.id} />
        </Modal>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Item"
          message={`Soft-delete "${confirmDelete.name}"? It will be hidden but can be restored by an Admin.`}
          onConfirm={() => softDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
          danger
        />
      )}
      {qrModal && (
        <QRModal title="Item QR Code" qrUrl={qrModal.url} itemInfo={qrModal.info} onClose={() => setQrModal(null)} />
      )}
      {roomQrData && (
        <QRModal title={`${room?.name} — Room QR`} qrUrl={roomQrData} itemInfo={{ 'Room': room?.name, 'Floor': room?.floor, 'Code': room?.code }} onClose={() => setRoomQrData(null)} />
      )}
    </div>
  )
}

// ── Item Form Modal ──────────────────────────────────────
function ItemFormModal({ title, item, presets, onClose, onSave }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [usePreset, setUsePreset] = useState(!item)
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'Equipment',
    quantity: item?.quantity ?? 0,
    unit: item?.unit || 'Piece(s)',
    status: item?.status || 'Functional',
    asset_tag: item?.asset_tag || '',
    location_detail: item?.location_detail || '',
    remarks: item?.remarks || '',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    if (!form.name.trim()) { toast('Item name is required', 'error'); return }
    setLoading(true)
    await onSave({ ...form, quantity: parseInt(form.quantity) || 0 })
    setLoading(false)
  }

  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : item ? 'Update Item' : 'Add Item'}</button>
      </>}
    >
      <div className="form-grid">
        <div className="form-field full">
          <label className="form-label">Item Name *</label>
          {!item && presets.length > 0 && (
            <select className="form-select" style={{ marginBottom: 6 }} value={usePreset ? form.name : '_custom_'}
              onChange={e => {
                if (e.target.value === '_custom_') { setUsePreset(false); setForm(f => ({ ...f, name: '' })) }
                else { setUsePreset(true); setForm(f => ({ ...f, name: e.target.value })) }
              }}>
              <option value="">— Select preset —</option>
              {presets.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="_custom_">+ Custom item...</option>
            </select>
          )}
          {(!usePreset || item) && (
            <input className="form-input" placeholder="Enter item name" value={form.name} onChange={set('name')} />
          )}
        </div>
        <div className="form-field">
          <label className="form-label">Category</label>
          <select className="form-select" value={form.category} onChange={set('category')}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Unit of Measure</label>
          <select className="form-select" value={form.unit} onChange={set('unit')}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Quantity</label>
          <input className="form-input" type="number" min="0" value={form.quantity} onChange={set('quantity')} />
        </div>
        <div className="form-field">
          <label className="form-label">Functional Status</label>
          <select className="form-select" value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Asset Tag</label>
          <input className="form-input" placeholder="Auto-generated if blank" value={form.asset_tag} onChange={set('asset_tag')} style={{ fontFamily: 'DM Mono, monospace' }} />
        </div>
        <div className="form-field">
          <label className="form-label">Location Detail</label>
          <input className="form-input" placeholder="Shelf / Bin / Cabinet" value={form.location_detail} onChange={set('location_detail')} />
        </div>
        <div className="form-field full">
          <label className="form-label">Remarks</label>
          <textarea className="form-textarea" placeholder="Optional notes..." value={form.remarks} onChange={set('remarks')} />
        </div>
      </div>
    </Modal>
  )
}
