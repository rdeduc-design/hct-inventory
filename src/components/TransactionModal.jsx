import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { useToast, Modal } from './UI'
import { TRANSACTION_TYPES } from '../lib/supabase'
import { ArrowDown, ArrowUp, ArrowLeftRight, RotateCcw, SlidersHorizontal } from 'lucide-react'

const TX_ICONS = {
  'Stock In': <ArrowDown size={14} />,
  'Stock Out': <ArrowUp size={14} />,
  'Transfer': <ArrowLeftRight size={14} />,
  'Return': <RotateCcw size={14} />,
  'Adjustment': <SlidersHorizontal size={14} />,
}

export function TransactionModal({ item, rooms, profile, onClose, onSuccess }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    transaction_type: 'Stock In',
    quantity_change: 1,
    to_room_id: '',
    reference_number: '',
    notes: '',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const isTransfer = form.transaction_type === 'Transfer'
  const isOut = ['Stock Out', 'Transfer'].includes(form.transaction_type)

  async function handleSubmit() {
    if (!form.quantity_change || form.quantity_change < 1) {
      toast('Quantity must be at least 1', 'error'); return
    }
    if (isTransfer && !form.to_room_id) {
      toast('Please select destination room for transfer', 'error'); return
    }
    const change = parseInt(form.quantity_change)
    const qty_change = isOut ? -change : change
    const new_qty = item.quantity + qty_change
    if (new_qty < 0) {
      toast(`Cannot reduce below 0. Current quantity: ${item.quantity}`, 'error'); return
    }

    setLoading(true)
    try {
      const oldQty = item.quantity

      // Update item quantity
      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update({ quantity: new_qty, updated_by: profile?.id, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (updateErr) throw updateErr

      // Record transaction
      const { error: txErr } = await supabase
        .from('inventory_transactions')
        .insert({
          item_id: item.id,
          transaction_type: form.transaction_type,
          quantity_change: qty_change,
          quantity_before: oldQty,
          quantity_after: new_qty,
          from_room_id: item.room_id,
          to_room_id: isTransfer ? form.to_room_id : null,
          reference_number: form.reference_number || null,
          notes: form.notes || null,
          performed_by: profile?.id,
        })
      if (txErr) throw txErr

      // If transfer, also update item's room
      if (isTransfer) {
        await supabase.from('inventory_items').update({ room_id: form.to_room_id }).eq('id', item.id)
      }

      // Audit
      await logAudit({
        action_type: 'Edited',
        record_type: 'Inventory Item',
        record_id: item.id,
        record_label: item.name,
        old_value: { quantity: oldQty },
        new_value: { quantity: new_qty, transaction_type: form.transaction_type },
        notes: `${form.transaction_type}: ${Math.abs(qty_change)} unit(s)`,
        profile,
      })

      toast(`${form.transaction_type} recorded. New quantity: ${new_qty}`, 'success')
      onSuccess()
      onClose()
    } catch (err) {
      toast(err.message || 'Transaction failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Record Transaction — ${item.name}`} onClose={onClose}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : 'Record Transaction'}
        </button>
      </>}
    >
      {/* Transaction type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
        {TRANSACTION_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setForm(f => ({ ...f, transaction_type: type }))}
            style={{
              padding: '10px 6px',
              borderRadius: 8,
              border: `2px solid ${form.transaction_type === type ? 'var(--teal)' : 'var(--border)'}`,
              background: form.transaction_type === type ? 'var(--teal-pale)' : 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              color: form.transaction_type === type ? 'var(--teal-dark)' : 'var(--text3)',
              transition: 'all .15s',
            }}
          >
            <span style={{ color: form.transaction_type === type ? 'var(--teal)' : 'var(--text3)' }}>{TX_ICONS[type]}</span>
            {type}
          </button>
        ))}
      </div>

      {/* Current quantity display */}
      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>Current Quantity</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', fontVariantNumeric: 'tabular-nums' }}>
          {item.quantity} {item.unit?.split('(')[0] || ''}
        </span>
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label className="form-label">Quantity *</label>
          <input className="form-input" type="number" min="1" value={form.quantity_change} onChange={set('quantity_change')} />
        </div>
        <div className="form-field">
          <label className="form-label">Reference No.</label>
          <input className="form-input" placeholder="PO/DR/Request No." value={form.reference_number} onChange={set('reference_number')} />
        </div>
        {isTransfer && (
          <div className="form-field full">
            <label className="form-label">Transfer To *</label>
            <select className="form-select" value={form.to_room_id} onChange={set('to_room_id')}>
              <option value="">— Select destination room —</option>
              {rooms.filter(r => r.id !== item.room_id).map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.floor})</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field full">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" placeholder="Optional notes..." value={form.notes} onChange={set('notes')} style={{ minHeight: 60 }} />
        </div>
      </div>

      {/* Preview */}
      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: isOut ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isOut ? '#fca5a5' : '#bbf7d0'}`, fontSize: 13 }}>
        <strong>{form.transaction_type}:</strong> {item.quantity} → {Math.max(0, item.quantity + (isOut ? -parseInt(form.quantity_change || 0) : parseInt(form.quantity_change || 0)))} {item.unit?.split('(')[0] || ''}
      </div>
    </Modal>
  )
}

export function TransactionHistory({ itemId }) {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)

  React.useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('inventory_transactions')
        .select('*, profiles!performed_by(full_name), from_room:rooms!from_room_id(name), to_room:rooms!to_room_id(name)')
        .eq('item_id', itemId)
        .order('performed_at', { ascending: false })
        .limit(50)
      setTxs(data || [])
      setLoading(false)
    }
    load()
  }, [itemId])

  if (loading) return <div style={{ padding: 16, color: 'var(--text3)', fontSize: 13 }}>Loading transactions...</div>
  if (!txs.length) return <div style={{ padding: 16, color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>No transactions recorded yet.</div>

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Change</th>
            <th>Before</th>
            <th>After</th>
            <th>By</th>
            <th>Reference</th>
            <th>Notes</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {txs.map(tx => (
            <tr key={tx.id}>
              <td>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {TX_ICONS[tx.transaction_type]}
                  <span style={{ fontSize: 12, fontWeight: 600, color: tx.quantity_change < 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {tx.transaction_type}
                  </span>
                </span>
              </td>
              <td style={{ fontWeight: 700, color: tx.quantity_change < 0 ? 'var(--danger)' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                {tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change}
              </td>
              <td style={{ color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{tx.quantity_before}</td>
              <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{tx.quantity_after}</td>
              <td style={{ fontSize: 12, color: 'var(--text3)' }}>{tx.profiles?.full_name || '—'}</td>
              <td style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text3)' }}>{tx.reference_number || '—'}</td>
              <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes || '—'}</td>
              <td style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(tx.performed_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
