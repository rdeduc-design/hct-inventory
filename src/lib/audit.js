import { supabase } from './supabase'

export async function logAudit({
  action_type,
  record_type,
  record_id = null,
  record_label = '',
  old_value = null,
  new_value = null,
  notes = '',
  profile,
}) {
  try {
    await supabase.from('audit_logs').insert({
      action_type,
      record_type,
      record_id,
      record_label,
      old_value,
      new_value,
      changed_by_id: profile?.id || null,
      changed_by_name: profile?.full_name || 'System',
      changed_by_role: profile?.role || 'unknown',
      notes,
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
