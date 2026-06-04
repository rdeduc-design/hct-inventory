import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/UI'
import Nav from './components/Nav'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import FloorPage from './pages/FloorPage'
import RoomPage from './pages/RoomPage'
import DashboardPage from './pages/DashboardPage'
import VRRegistryPage from './pages/VRRegistryPage'
import RequestsPage from './pages/RequestsPage'
import AuditLogPage from './pages/AuditLogPage'
import UsersPage from './pages/UsersPage'
import './index.css'

function ProtectedRoute({ children, requireRole = null }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTop: '3px solid var(--teal)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requireRole === 'admin' && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  if (requireRole === 'audit' && !['admin', 'supply_officer'].includes(profile?.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppLayout({ children }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><HomePage /></AppLayout></ProtectedRoute>} />
            <Route path="/floor/:floorKey" element={<ProtectedRoute><AppLayout><FloorPage /></AppLayout></ProtectedRoute>} />
            <Route path="/room/:roomCode" element={<ProtectedRoute><AppLayout><RoomPage /></AppLayout></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
            <Route path="/vr-registry" element={<ProtectedRoute><AppLayout><VRRegistryPage /></AppLayout></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><AppLayout><RequestsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/audit-log" element={<ProtectedRoute requireRole="audit"><AppLayout><AuditLogPage /></AppLayout></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireRole="admin"><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  )
}
