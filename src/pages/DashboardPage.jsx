import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ items: [], rooms: [], requests: [], vr: [], recent: [], recentReqs: [] })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: items }, { data: rooms }, { data: requests }, { data: vr }, { data: recent }, { data: recentReqs }] = await Promise.all([
      supabase.from('inventory_items').select('id, status, category, room_id').eq('is_deleted', false),
      supabase.from('rooms').select('*'),
      supabase.from('requests').select('id, status').eq('is_deleted', false),
      supabase.from('vr_assets').select('id, status').eq('is_deleted', false),
      supabase.from('inventory_items').select('name, status, updated_at, rooms(name)').eq('is_deleted', false).order('updated_at', { ascending: false }).limit(5),
      supabase.from('requests').select('item_name, requester_name, priority, status').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
    ])
    setData({ items: items || [], rooms: rooms || [], requests: requests || [], vr: vr || [], recent: recent || [], recentReqs: recentReqs || [] })
    setLoading(false)
  }

  if (loading) return <div className="main"><Spinner /></div>

  const { items, rooms, requests, vr, recent, recentReqs } = data
  const total = items.length
  const functional = items.filter(i => i.status === 'Functional').length
  const notFunctional = items.filter(i => i.status === 'Not Functional').length
  const underRepair = items.filter(i => i.status === 'Under Repair').length
  const missing = items.filter(i => i.status === 'Missing').length
  const pendingReqs = requests.filter(r => r.status === 'Pending').length
  const approvedReqs = requests.filter(r => r.status === 'Approved').length

  // By room
  const roomMap = {}
  rooms.forEach(r => roomMap[r.id] = { ...r, count: 0 })
  items.forEach(i => { if (roomMap[i.room_id]) roomMap[i.room_id].count++ })
  const roomStats = Object.values(roomMap).sort((a, b) => b.count - a.count).slice(0, 8)
  const maxRoom = Math.max(...roomStats.map(r => r.count), 1)

  // By category
  const catMap = {}
  items.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + 1 })
  const catStats = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(...catStats.map(c => c[1]), 1)

  const StatusBadge = ({ s }) => {
    const cls = { Functional: 'functional', 'Not Functional': 'not-functional', 'Under Repair': 'repair', Missing: 'missing', Pending: 'pending', Approved: 'approved', Released: 'released', Denied: 'denied', Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent' }
    return <span className={`badge badge-${cls[s] || 'other'}`}>{s}</span>
  }

  return (
    <div className="main">
      <div className="page-header">
        <div><div className="page-title">Dashboard</div><div className="page-subtitle">System-wide inventory analytics</div></div>
      </div>

      <div className="stat-cards">
        <div className="stat-card navy"><div className="sc-label">Total Items</div><div className="sc-val">{total}</div><div className="sc-sub">All rooms</div></div>
        <div className="stat-card teal"><div className="sc-label">Functional</div><div className="sc-val">{functional}</div><div className="sc-sub">{total ? Math.round(functional / total * 100) : 0}%</div></div>
        <div className="stat-card"><div className="sc-label">Not Functional</div><div className="sc-val">{notFunctional}</div></div>
        <div className="stat-card"><div className="sc-label">Under Repair</div><div className="sc-val">{underRepair}</div></div>
        <div className="stat-card"><div className="sc-label">Missing</div><div className="sc-val">{missing}</div></div>
        <div className="stat-card"><div className="sc-label">VR Assets</div><div className="sc-val">{vr.length}</div><div className="sc-sub">{vr.filter(v => v.status === 'Functional').length} functional</div></div>
        <div className="stat-card"><div className="sc-label">Pending Requests</div><div className="sc-val">{pendingReqs}</div></div>
        <div className="stat-card"><div className="sc-label">Approved</div><div className="sc-val">{approvedReqs}</div><div className="sc-sub">Ready for release</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="table-wrap" style={{ padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 14 }}>Inventory by Room</div>
          <div className="chart-bar-wrap">
            {roomStats.map(r => (
              <div key={r.id} className="chart-bar-row">
                <div className="chart-bar-label" title={r.name}>{r.abbreviation}</div>
                <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: `${Math.round(r.count / maxRoom * 100)}%` }} /></div>
                <div className="chart-bar-val">{r.count}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="table-wrap" style={{ padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', marginBottom: 14 }}>Inventory by Category</div>
          <div className="chart-bar-wrap">
            {catStats.map(([cat, cnt]) => (
              <div key={cat} className="chart-bar-row">
                <div className="chart-bar-label" title={cat}>{cat.length > 11 ? cat.slice(0, 11) + '…' : cat}</div>
                <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: `${Math.round(cnt / maxCat * 100)}%` }} /></div>
                <div className="chart-bar-val">{cnt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="table-wrap">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Recently Updated Items</div>
          <table><thead><tr><th>Item</th><th>Room</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>{recent.map((i, idx) => (
              <tr key={idx}>
                <td style={{ fontSize: 13 }}>{i.name}</td>
                <td style={{ fontSize: 12, color: 'var(--text3)' }}>{i.rooms?.name || '—'}</td>
                <td><StatusBadge s={i.status} /></td>
                <td style={{ fontSize: 11, color: 'var(--text3)' }}>{i.updated_at?.split('T')[0]}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="table-wrap">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Recent Requests</div>
          <table><thead><tr><th>Item</th><th>Requester</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>{recentReqs.map((r, idx) => (
              <tr key={idx}>
                <td style={{ fontSize: 13 }}>{r.item_name}</td>
                <td style={{ fontSize: 12, color: 'var(--text3)' }}>{r.requester_name}</td>
                <td><StatusBadge s={r.priority} /></td>
                <td><StatusBadge s={r.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
