import React, { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, Trash2 } from 'lucide-react'

// ── Toast System ──────────────────────────────────────────
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  const icons = { success: <CheckCircle size={16} />, error: <AlertCircle size={16} />, info: <Info size={16} /> }
  const colors = { success: '#2ABFBF', error: '#e53e3e', info: '#3182ce' }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{ borderLeft: `3px solid ${colors[t.type] || colors.info}` }}>
            <span style={{ color: colors[t.type] || colors.info }}>{icons[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ── Modal ─────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const maxW = size === 'lg' ? 800 : size === 'sm' ? 440 : 640

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,30,64,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: maxW, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--navy)' }}>{title}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px 24px', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────
export function ConfirmDialog({ title, message, onConfirm, onCancel, danger = false }) {
  return (
    <Modal title={title} onClose={onCancel} size="sm"
      footer={<>
        <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{danger ? <><Trash2 size={14} /> Delete</> : 'Confirm'}</button>
      </>}
    >
      <p style={{ color: 'var(--text2)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}

// ── Badge ─────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    'Functional': 'functional', 'Not Functional': 'not-functional',
    'Under Repair': 'repair', 'Missing': 'missing',
    'Pending': 'pending', 'Approved': 'approved', 'Released': 'released',
    'Denied': 'denied', 'Returned': 'returned',
    'Low': 'low', 'Medium': 'medium', 'High': 'high', 'Urgent': 'urgent',
    'Stock In': 'stock-in', 'Stock Out': 'stock-out',
    'Transfer': 'transfer', 'Return': 'return', 'Adjustment': 'adjustment',
  }
  return <span className={`badge badge-${map[status] || 'other'}`}>{status}</span>
}

export function RoleBadge({ role }) {
  const labels = { viewer: 'Viewer', staff: 'Staff', custodian: 'Custodian', supply_officer: 'Supply Officer', admin: 'Admin' }
  return <span className={`badge badge-role-${role}`}>{labels[role] || role}</span>
}

// ── Loading Spinner ───────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: size, height: size, border: '3px solid var(--border)', borderTop: '3px solid var(--teal)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────
export function EmptyState({ icon, message, action }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.35 }}>{icon}</div>
      <p>{message}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

// ── QR Modal ──────────────────────────────────────────────
export function QRModal({ title, qrUrl, itemInfo, onClose }) {
  return (
    <Modal title={title} onClose={onClose} size="sm"
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => {
          const a = document.createElement('a'); a.href = qrUrl
          a.download = `${title.replace(/\s/g, '_')}_QR.png`; a.click()
        }}>Download QR</button>
      </>}
    >
      <div style={{ textAlign: 'center' }}>
        <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, margin: '0 auto 16px', display: 'block' }} />
        {itemInfo && <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', textAlign: 'left', fontSize: 13 }}>
          {Object.entries(itemInfo).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text3)' }}>{k}</span>
              <span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>}
      </div>
    </Modal>
  )
}
