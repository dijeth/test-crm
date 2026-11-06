import { requireSupabase } from './supabase'
import type { EmployeeOption, UserProfile } from './types'

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('role, name')
    .eq('id', userId)
    .single()
  if (error) throw error

  const role = data.role === 'director' || data.role === 'employee' ? data.role : null
  return { role, name: data.name }
}

export async function getEmployees(): Promise<EmployeeOption[]> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, name')
    .eq('role', 'employee')
    .order('name')
  if (error) throw error
  return data.map((employee) => ({
    value: employee.id,
    label: employee.name || employee.id,
  }))
}
