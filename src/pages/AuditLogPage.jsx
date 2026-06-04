import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner, EmptyState } from '../components/UI'
import { Search, ChevronDown } from 'lucide-react'

const ACTION_COLORS = {
  Created: { bg: '#d1fae5', text: '#065f46' },
  Edited: { bg: '#dbeafe', text: '#1e40af' },
  Deleted: { bg: '#fee2e2', text: '#991b1b' },
  Restored: { bg: '#ede9fe', text: '#5b21b6' },
  Exported: { bg: '#fef3c7', text: '#92400e' },
  Approved: { bg: '#d1fae5', text: '#065f46' },
  Released: { bg: '#ede9fe', text: '#5b21b6' },
  Denied: { bg: '#fee2e2', text: '#991b1b' },
  Transferred: { bg: '#dbeafe', text: '#1e40af' },
  Login: { bg: '#f3f4f6', text: '#374151' },
  Logout: { bg: '#f3f4f6', text: '#374151' },
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterRecord, setFilterRecord] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => { loadLogs() }, [page])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setLogs(data || [])
    setLoading(false)
  }

  function getFiltered() {
    let out = [...logs]
    if (search) out = out.filter(l => [l.record_label || '', l.changed_by_name || '', l.notes || ''].some(v => v.toLowerCase().includes(search.toLowerCase())))
    if (filterAction !== 'all') out = out.filter(l => l.action_type === filterAction)
    if (filterRecord !== 'all') out = out.filter(l => l.record_type === filterRecord)
    return out
  }

  function formatValue(v) {
    if (!v) return '—'
    try {
      return JSON.stringify(v, null, 2)
    } catch { return String(v) }
  }

  const filtered = getFiltered()

  return (
    <div className="main">
      <div className="page-header">
        <div><div className="page-title">Audit Log</div><div className="page-subtitle">OWASP-compliant application activity log — all changes tracked</div></div>
      </div>

      <div className="toolbar">
        <div className="search-box"><Search size={14} className="search-icon" /><input placeholder="Search by record, user, or notes..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="form-select" style={{ height: 36, width: 'auto' }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="all">All Actions</option>
          {Object.keys(ACTION_COLORS).map(a => <option key={a}>{a}</option>)}
        </select>
        <select className="form-select" style={{ height: 36, width: 'auto' }} value={filterRecord} onChange={e => setFilterRecord(e.target.value)}>
          <option value="all">All Record Types</option>
          {['Inventory Item', 'VR Asset', 'Request', 'Transaction', 'User', 'Room'].map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Record Type</th>
                  <th>Record</th>
                  <th>Changed By</th>
                  <th>Role</th>
                  <th>Notes</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState icon="📋" message="No audit log entries." /></td></tr>
                ) : filtered.map(log => {
                  const colors = ACTION_COLORS[log.action_type] || { bg: '#f3f4f6', text: '#374151' }
                  const isExpanded = expandedId === log.id
                  const hasChanges = log.old_value || log.new_value

                  return (
                    <React.Fragment key={log.id}>
                      <tr>
                        <td style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'medium' })}
                        </td>
                        <td>
                          <span className="badge" style={{ background: colors.bg, color: colors.text }}>{log.action_type}</span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{log.record_type}</td>
                        <td style={{ fontSize: 13, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.record_label || '—'}</td>
                        <td style={{ fontSize: 13 }}>{log.changed_by_name || '—'}</td>
                        <td>
                          {log.changed_by_role && (
                            <span className={`badge badge-role-${log.changed_by_role}`}>{log.changed_by_role?.replace('_', ' ')}</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.notes || '—'}</td>
                        <td>
                          {hasChanges && (
                            <button className="btn btn-ghost btn-xs" onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                              <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} /> View
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: '0 14px 14px', background: 'var(--surface2)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                              {log.old_value && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>BEFORE</div>
                                  <pre style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: 'DM Mono, monospace', overflow: 'auto', color: '#991b1b' }}>{formatValue(log.old_value)}</pre>
                                </div>
                              )}
                              {log.new_value && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>AFTER</div>
                                  <pre style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: 'DM Mono, monospace', overflow: 'auto', color: '#065f46' }}>{formatValue(log.new_value)}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="table-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{filtered.length} entries shown</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
              <span style={{ padding: '0 8px', lineHeight: '30px', fontSize: 12 }}>Page {page + 1}</span>
              <button className="btn btn-outline btn-sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
