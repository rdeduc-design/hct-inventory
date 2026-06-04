import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Copy .env.example to .env.local and fill in your credentials.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// ── Constants ──────────────────────────────────────────────
export const CATEGORIES = ['Equipment', 'Consumable', 'Furniture', 'Medical Supply', 'Simulation Material', 'Technology', 'Other']
export const UNITS = ['Piece(s)', 'Box(es)', 'Set(s)', 'Pack(s)', 'Bottle(s)', 'Other']
export const STATUSES = ['Functional', 'Not Functional', 'Under Repair', 'Missing']
export const TRANSACTION_TYPES = ['Stock In', 'Stock Out', 'Transfer', 'Return', 'Adjustment']
export const REQUEST_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
export const REQUEST_STATUSES = ['Pending', 'Approved', 'Released', 'Denied', 'Returned']

export const ROLE_LABELS = {
  viewer: 'Viewer',
  staff: 'Student / Staff',
  custodian: 'Room Custodian',
  supply_officer: 'Supply Officer',
  admin: 'Administrator',
}

export const ROLE_PERMISSIONS = {
  viewer:         { canView: true, canSubmitRequest: false, canEditInventory: false, canManageSupply: false, canDelete: false, canManageUsers: false, canViewAudit: false },
  staff:          { canView: true, canSubmitRequest: true,  canEditInventory: false, canManageSupply: false, canDelete: false, canManageUsers: false, canViewAudit: false },
  custodian:      { canView: true, canSubmitRequest: true,  canEditInventory: true,  canManageSupply: false, canDelete: false, canManageUsers: false, canViewAudit: false },
  supply_officer: { canView: true, canSubmitRequest: true,  canEditInventory: true,  canManageSupply: true,  canDelete: false, canManageUsers: false, canViewAudit: true  },
  admin:          { canView: true, canSubmitRequest: true,  canEditInventory: true,  canManageSupply: true,  canDelete: true,  canManageUsers: true,  canViewAudit: true  },
}

export const PRESET_ITEMS = {
  'icu':  ['Hospital Bed','Cardiac Monitor','Defibrillator','Infusion Pump','Syringe Pump','Ventilator','Oxygen Tank','Suction Machine','ECG Machine','Crash Cart','IV Stand','Pulse Oximeter','Adult Manikin','Pediatric Manikin','Neonatal Manikin'],
  'aha':  ['CPR Manikins','AED Trainers','BVM Devices','Airway Trainers','CPR Feedback Devices'],
  'or':   ['Operating Table','Surgical Light','Mayo Stand','Instrument Tray','Anesthesia Machine','Electrocautery Machine','Suction Apparatus','Surgical Instrument Sets','Back Table','OR Stools'],
  'dr':   ['Delivery Bed','Infant Warmer','Fetal Doppler','Delivery Instrument Set','Newborn Scale','Resuscitation Equipment','Obstetric Manikins'],
  'ems':  ['Spine Board','Scoop Stretcher','Cervical Collar','Ambulance Equipment','Trauma Kits','Splints','Extrication Devices'],
  'care': ['Wheelchair','Walker','Cane','Bedside Commode','Patient Transfer Equipment'],
  'vr':   ['VR Headset','VR Controller','Charging Dock','VR Sensors','VR Computer/Workstation','VR Accessories'],
  'csr':  ['Bandages','Syringes','Gloves (Box)','Face Masks','IV Tubing','Foley Catheter','NG Tube','Sterile Drapes','Suture Sets','Storage Racks','Medical Cart','Office Chair'],
}

export function getPresetItems(roomCode) {
  const key = roomCode.replace(/^(5th|3rd)-/, '')
  return PRESET_ITEMS[key] || []
}
