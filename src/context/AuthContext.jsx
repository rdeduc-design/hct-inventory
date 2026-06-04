import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signInWithOtp(email) {
    const { data, error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } })
    return { data, error }
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const perms = profile ? {
    canView: true,
    canSubmitRequest: ['staff','custodian','supply_officer','admin'].includes(profile.role),
    canEditInventory: ['custodian','supply_officer','admin'].includes(profile.role),
    canManageSupply: ['supply_officer','admin'].includes(profile.role),
    canDelete: profile.role === 'admin',
    canManageUsers: profile.role === 'admin',
    canViewAudit: ['supply_officer','admin'].includes(profile.role),
    canApproveRequests: ['supply_officer','admin'].includes(profile.role),
    isAdmin: profile.role === 'admin',
    isCustodian: profile.role === 'custodian',
    assignedRooms: profile.assigned_rooms || [],
    canEditRoom: (roomCode) => {
      if (['supply_officer','admin'].includes(profile.role)) return true
      if (profile.role === 'custodian') return (profile.assigned_rooms || []).includes(roomCode)
      return false
    }
  } : { canView: false }

  return (
    <AuthContext.Provider value={{ user, profile, loading, perms, signIn, signInWithOtp, signUp, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
