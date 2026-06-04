import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/UI'
import { Building2, Layers, Archive, ArrowRight, PackageCheck, Wrench, AlertTriangle } from 'lucide-react'

const FLOOR_CONFIG = {
  '5th': {
    title: '5th Floor',
    description: 'ICU · AHA · Operating Room · Delivery Room',
    icon: <Building2 size={24} />,
    roomPrefixes: ['5th-'],
  },
  '3rd': {
    title: '3rd Floor',
    description: 'ICU · OR · DR · VR · Caregiving · EMS',
    icon: <Layers size={24} />,
    roomPrefixes: ['3rd-'],
  },
  central: {
    title: 'Central Supply Room',
    description: 'Centralized storage for all medical and simulation supplies',
    icon: <Archive size={24} />,
    roomPrefixes: ['csr'],
    direct: true,
  },
}

function FloorCard({ config, floorKey, rooms, stats, onClick }) {
  const roomCount = floorKey === 'central' ? 1 : (rooms?.length || 0)
  const total = stats?.total || 0
  const functional = stats?.functional || 0
  const notFunctional = stats?.notFunctional || 0

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1.5px solid var(--border)',
        padding: '28px 24px',
        cursor: 'pointer',
        transition: 'all .2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(42,191,191,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Decorative circle */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'var(--teal-pale)', opacity: 0.5 }} />

      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--teal)' }}>
        {config.icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>{config.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>{config.description}</div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>{total}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Total Items</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{functional}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Functional</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>{roomCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Rooms</div>
        </div>
      </div>

      {/* Arrow */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowRight size={14} style={{ color: 'var(--teal)' }} />
      </div>
    </div>
  )
}

export default function HomePage() {
  const { perms } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [globalStats, setGlobalStats] = useState({ total: 0, functional: 0, notFunctional: 0, underRepair: 0, pendingRequests: 0 })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: roomsData }, { data: itemsData }, { data: requestsData }] = await Promise.all([
        supabase.from('rooms').select('*').order('floor').order('name'),
        supabase.from('inventory_items').select('id, status, room_id').eq('is_deleted', false),
        supabase.from('requests').select('id, status').eq('is_deleted', false).eq('status', 'Pending'),
      ])

      setRooms(roomsData || [])

      // Compute per-room stats
      const roomStats = {}
      ;(itemsData || []).forEach(item => {
        if (!roomStats[item.room_id]) roomStats[item.room_id] = { total: 0, functional: 0, notFunctional: 0 }
        roomStats[item.room_id].total++
        if (item.status === 'Functional') roomStats[item.room_id].functional++
        if (item.status === 'Not Functional') roomStats[item.room_id].notFunctional++
      })
      setStats(roomStats)

      const allItems = itemsData || []
      setGlobalStats({
        total: allItems.length,
        functional: allItems.filter(i => i.status === 'Functional').length,
        notFunctional: allItems.filter(i => i.status === 'Not Functional').length,
        underRepair: allItems.filter(i => i.status === 'Under Repair').length,
        pendingRequests: (requestsData || []).length,
      })
    } finally {
      setLoading(false)
    }
  }

  function getFloorStats(floorKey) {
    let prefix
    if (floorKey === '5th') prefix = '5th'
    else if (floorKey === '3rd') prefix = '3rd'
    else prefix = 'csr'

    const floorRooms = rooms.filter(r =>
      floorKey === 'central' ? r.code === 'csr' : r.code.startsWith(prefix + '-')
    )
    let total = 0, functional = 0, notFunctional = 0
    floorRooms.forEach(r => {
      const s = stats[r.id] || {}
      total += s.total || 0
      functional += s.functional || 0
      notFunctional += s.notFunctional || 0
    })
    return { total, functional, notFunctional }
  }

  function handleFloorClick(floorKey) {
    if (floorKey === 'central') {
      const csrRoom = rooms.find(r => r.code === 'csr')
      if (csrRoom) navigate(`/room/${csrRoom.code}`)
    } else {
      navigate(`/floor/${floorKey}`)
    }
  }

  if (loading) return <div className="main"><Spinner /></div>

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <div className="page-title">Inventory Management</div>
          <div className="page-subtitle">Healthcare and Technology Institute Inc. — Pasig City, Philippines</div>
        </div>
      </div>

      {/* Floor cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {Object.entries(FLOOR_CONFIG).map(([key, config]) => (
          <FloorCard
            key={key}
            config={config}
            floorKey={key}
            rooms={rooms.filter(r => key === 'central' ? r.code === 'csr' : r.floor === config.title)}
            stats={getFloorStats(key)}
            onClick={() => handleFloorClick(key)}
          />
        ))}
      </div>

      {/* Global quick stats */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 12 }}>System Overview</div>
      </div>
      <div className="stat-cards">
        <div className="stat-card navy"><div className="sc-label">Total Items</div><div className="sc-val">{globalStats.total}</div><div className="sc-sub">All rooms combined</div></div>
        <div className="stat-card teal"><div className="sc-label">Functional</div><div className="sc-val">{globalStats.functional}</div><div className="sc-sub">Ready for use</div></div>
        <div className="stat-card"><div className="sc-label">Under Repair</div><div className="sc-val">{globalStats.underRepair}</div><div className="sc-sub">Being serviced</div></div>
        <div className="stat-card"><div className="sc-label">Not Functional</div><div className="sc-val">{globalStats.notFunctional}</div><div className="sc-sub">Needs attention</div></div>
        <div className="stat-card"><div className="sc-label">Pending Requests</div><div className="sc-val">{globalStats.pendingRequests}</div><div className="sc-sub">Awaiting action</div></div>
      </div>
    </div>
  )
}
