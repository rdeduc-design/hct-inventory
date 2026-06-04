import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { ChevronRight, Activity, Heart, Scissors, Baby, Monitor, Users, Truck, Warehouse } from 'lucide-react'

const ROOM_ICONS = {
  activity: <Activity size={18} />,
  heart: <Heart size={18} />,
  scissors: <Scissors size={18} />,
  baby: <Baby size={18} />,
  monitor: <Monitor size={18} />,
  users: <Users size={18} />,
  truck: <Truck size={18} />,
  warehouse: <Warehouse size={18} />,
  box: <Warehouse size={18} />,
}

const FLOOR_LABELS = { '5th': '5th Floor', '3rd': '3rd Floor' }

export default function FloorPage() {
  const { floorKey } = useParams()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRooms()
  }, [floorKey])

  async function loadRooms() {
    setLoading(true)
    try {
      const floorName = FLOOR_LABELS[floorKey]
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .eq('floor', floorName)
        .order('name')

      const roomIds = (roomsData || []).map(r => r.id)
      const { data: itemsData } = await supabase
        .from('inventory_items')
        .select('id, status, room_id')
        .in('room_id', roomIds)
        .eq('is_deleted', false)

      const roomStats = {}
      ;(itemsData || []).forEach(item => {
        if (!roomStats[item.room_id]) roomStats[item.room_id] = { total: 0, functional: 0, notFunctional: 0, underRepair: 0 }
        roomStats[item.room_id].total++
        if (item.status === 'Functional') roomStats[item.room_id].functional++
        if (item.status === 'Not Functional') roomStats[item.room_id].notFunctional++
        if (item.status === 'Under Repair') roomStats[item.room_id].underRepair++
      })

      setRooms(roomsData || [])
      setStats(roomStats)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="main"><Spinner /></div>

  const floorLabel = FLOOR_LABELS[floorKey] || floorKey

  return (
    <div className="main">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>›</span>
        <span>{floorLabel}</span>
      </div>

      <div className="section-header">
        <Activity size={22} style={{ color: 'var(--teal)' }} />
        <div>
          <div className="sh-title">{floorLabel}</div>
          <div className="sh-sub">{rooms.length} simulation rooms</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {rooms.map(room => {
          const s = stats[room.id] || { total: 0, functional: 0 }
          return (
            <div
              key={room.id}
              onClick={() => navigate(`/room/${room.code}`)}
              style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '18px 20px', cursor: 'pointer', transition: 'all .18s', display: 'flex', alignItems: 'center', gap: 14 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', flexShrink: 0 }}>
                {ROOM_ICONS[room.icon] || ROOM_ICONS.box}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>{room.name} <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>({room.abbreviation})</span></div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.total} items · {s.functional} functional</div>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text3)' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
