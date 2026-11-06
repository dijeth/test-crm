import { useState } from 'react'
import { Alert, Anchor, Box, Button, Container, Group, Paper, Text } from '@mantine/core'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useCurrentProfile } from '../queries/crm'
import type { CrmRouteContext } from '../router/routeContext'

export function CrmLayout() {
  const { supabase } = useAuth()
  const profileQuery = useCurrentProfile()
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const role: CrmRouteContext['role'] = profileQuery.data?.role ?? null
  const profileName = profileQuery.data?.name
  const roleError = profileQuery.error instanceof Error
    ? profileQuery.error.message
    : profileQuery.data && !profileQuery.data.role
      ? 'Не удалось определить роль пользователя'
      : null
  const links = role === 'director'
    ? [{ to: '/objects', label: 'Объекты' }]
    : role === 'employee'
      ? [{ to: '/my-tasks', label: 'Мои задачи' }]
      : []

  async function handleSignOut() {
    if (!supabase) return
    setSignOutError(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setSignOutError(error.message)
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : 'Не удалось выйти из аккаунта')
    }
  }

  return (
    <Box>
      <Paper component="header" radius={0} withBorder px="md" py="sm">
        <Container size="lg">
          <Group justify="space-between">
            <Group gap="lg">
              <Text fw={700}>CRM</Text>
              {links.map(({ to, label }) => (
                <Anchor key={to} component={Link} to={to} c="dark" underline="never">
                  {label}
                </Anchor>
              ))}
            </Group>
            <Group gap="sm">
              {profileName && <Text size="sm" fw={500}>{profileName}</Text>}
              <Button
                variant="subtle"
                onClick={() => void handleSignOut()}
              >
                Выйти
              </Button>
            </Group>
          </Group>
        </Container>
      </Paper>
      <Container size="lg" py="xl">
        {roleError && <Alert color="red" mb="md">{roleError}</Alert>}
        {signOutError && <Alert color="red" mb="md">{signOutError}</Alert>}
        <Outlet context={{ role } satisfies CrmRouteContext} />
      </Container>
    </Box>
  )
}
