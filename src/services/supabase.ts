import { supabase } from '../lib/supabase'

export function requireSupabase() {
  if (!supabase) throw new Error('Не удалось подключиться к Supabase')
  return supabase
}
