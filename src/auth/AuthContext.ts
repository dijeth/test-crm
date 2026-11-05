import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthContextValue = {
  session: Session | null
  loading: boolean
  error: string | null
  supabase: typeof import('../lib/supabase').supabase
}

export const AuthContext = createContext<AuthContextValue | null>(null)
