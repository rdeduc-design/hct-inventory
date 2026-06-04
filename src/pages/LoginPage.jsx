import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/UI'
import { Mail, Lock, User, Eye, EyeOff, Shield } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp, signInWithOtp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // login | signup | magic
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', fullName: '' })
  const [magicSent, setMagicSent] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'magic') {
        const { error } = await signInWithOtp(form.email)
        if (error) throw error
        setMagicSent(true)
      } else if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) throw error
        navigate('/')
      } else {
        const { error } = await signUp(form.email, form.password, form.fullName)
        if (error) throw error
        toast('Account created! Check your email to verify.', 'success')
        setMode('login')
      }
    } catch (err) {
      toast(err.message || 'Authentication failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--navy) 0%, #1a3060 50%, #0d2a4a 100%)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: 'var(--navy)', margin: '0 auto 16px' }}>HCT</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>HCT Inventory System</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Healthcare & Technology Institute Inc.</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '28px 32px', boxShadow: 'var(--shadow-lg)' }}>
          {/* Mode tabs */}
          <div className="tabs" style={{ marginBottom: 24 }}>
            <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign In</button>
            <button className={`tab ${mode === 'magic' ? 'active' : ''}`} onClick={() => setMode('magic')}>Magic Link</button>
            <button className={`tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>Register</button>
          </div>

          {magicSent ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Mail size={40} style={{ color: 'var(--teal)', margin: '0 auto 12px', display: 'block' }} />
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Check your email</h3>
              <p style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>We sent a magic link to <strong>{form.email}</strong>. Click it to sign in instantly — no password needed.</p>
              <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => setMagicSent(false)}>Back</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'signup' && (
                <div className="form-field">
                  <label className="form-label">Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Juan dela Cruz" value={form.fullName} onChange={set('fullName')} required />
                  </div>
                </div>
              )}
              <div className="form-field">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input className="form-input" style={{ paddingLeft: 32 }} type="email" placeholder="you@hct.ph" value={form.email} onChange={set('email')} required />
                </div>
              </div>
              {(mode === 'login' || mode === 'signup') && (
                <div className="form-field">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input className="form-input" style={{ paddingLeft: 32, paddingRight: 36 }} type={showPw ? 'text' : 'password'} placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'} value={form.password} onChange={set('password')} required minLength={mode === 'signup' ? 8 : 1} />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ height: 42, fontSize: 14, marginTop: 4 }}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'magic' ? 'Send Magic Link' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Role info */}
          <div style={{ marginTop: 20, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 8 }}>
            <Shield size={14} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
              New accounts start as <strong>Viewer</strong>. An administrator will upgrade your access based on your role at HCT.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
