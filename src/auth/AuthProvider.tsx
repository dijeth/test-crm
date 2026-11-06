import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from './AuthContext'
import { supabase } from '../lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const currentUserId = useRef<string | null>(null)
  const effectRun = useRef(0)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    const runId = ++effectRun.current
    const isCurrentRun = () => effectRun.current === runId
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null
      if (currentUserId.current !== nextUserId) {
        queryClient.clear()
        currentUserId.current = nextUserId
      }
      setSession(nextSession)
    }

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!isCurrentRun()) return
        if (sessionError) setError(sessionError.message)
        applySession(data.session)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (!isCurrentRun()) return
        setError(cause instanceof Error ? cause.message : 'Не удалось проверить сессию')
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isCurrentRun()) applySession(nextSession)
    })

    return () => {
      effectRun.current += 1
      subscription.unsubscribe()
    }
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ session, loading, error, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}
