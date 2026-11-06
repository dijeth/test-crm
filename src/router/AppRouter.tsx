import type { ReactNode } from 'react'
import { Loader } from '@mantine/core'
import { Navigate, Outlet, Route, Routes, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { CrmLayout } from '../Layout/CrmLayout'
import { LoginPage } from '../pages/LoginPage'
import { MyTasksPage } from '../pages/MyTasksPage'
import { ObjectPage } from '../pages/ObjectPage'
import { ObjectsPage } from '../pages/ObjectsPage'
import { TaskPage } from '../pages/TaskPage'
import type { CrmRouteContext } from './routeContext'

function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Loader mx="auto" mt="xl" />
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

function HomeRedirect() {
  const { role } = useOutletContext<CrmRouteContext>()
  if (role === 'director') return <Navigate to="/objects" replace />
  if (role === 'employee') return <Navigate to="/my-tasks" replace />
  return null
}

function RoleRoute({
  role: requiredRole,
  children,
}: {
  role: Exclude<CrmRouteContext['role'], null>
  children: ReactNode
}) {
  const { role } = useOutletContext<CrmRouteContext>()
  if (!role) return null
  if (role !== requiredRole) {
    return <Navigate to={role === 'director' ? '/objects' : '/my-tasks'} replace />
  }
  return children
}

export default function AppRouter() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<CrmLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/objects" element={<RoleRoute role="director"><ObjectsPage /></RoleRoute>} />
          <Route path="/objects/:objectId" element={<RoleRoute role="director"><ObjectPage /></RoleRoute>} />
          <Route path="/tasks/:taskId" element={<RoleRoute role="director"><TaskPage /></RoleRoute>} />
          <Route path="/my-tasks" element={<RoleRoute role="employee"><MyTasksPage /></RoleRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
    </Routes>
  )
}
