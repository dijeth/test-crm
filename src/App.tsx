import { useState, type FormEvent } from 'react'
import {
  Alert,
  Anchor,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { useAuth } from './auth/useAuth'

function LoginPage() {
  const { supabase, error: authError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setSubmitting(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) setError(signInError.message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить вход')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container size={420} py="xl">
      <Paper withBorder p="xl" radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            <div>
              <Title order={2}>Вход в CRM</Title>
              <Text c="dimmed" size="sm" mt={4}>Войдите с рабочей учётной записью</Text>
            </div>
            {!supabase && (
              <Alert color="yellow" title="Supabase не настроен">
                Скопируйте .env.example в .env.local и укажите URL и публичный ключ проекта.
              </Alert>
            )}
            {(error || authError) && <Alert color="red">{error || authError}</Alert>}
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Пароль"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <Button type="submit" loading={submitting} disabled={!supabase}>
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}

function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Loader mx="auto" mt="xl" />
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

function CrmLayout() {
  const { supabase } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const links = [
    { to: '/objects', label: 'Объекты' },
    { to: '/my-tasks', label: 'Мои задачи' },
  ]

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
            <Button
              variant="subtle"
              onClick={() => void handleSignOut()}
            >
              Выйти
            </Button>
          </Group>
        </Container>
      </Paper>
      <Container size="lg" py="xl">
        {signOutError && <Alert color="red" mb="md">{signOutError}</Alert>}
        <Outlet />
      </Container>
    </Box>
  )
}

function DataPlaceholder({ description }: { description: string }) {
  return (
    <Paper withBorder p="lg" radius="md">
      <Text c="dimmed">{description}</Text>
    </Paper>
  )
}

function ObjectsPage() {
  return (
    <Stack>
      <Title order={2}>Объекты</Title>
      <DataPlaceholder description="Список объектов появится после подключения схемы данных Supabase." />
    </Stack>
  )
}

function ObjectPage() {
  const { objectId } = useParams()
  return (
    <Stack>
      <Anchor component={Link} to="/objects">← Все объекты</Anchor>
      <Title order={2}>Карточка объекта</Title>
      <DataPlaceholder description={`Объект ${objectId}: здесь будут данные объекта и связанные задачи.`} />
    </Stack>
  )
}

function TaskPage() {
  const { taskId } = useParams()
  return (
    <Stack>
      <Anchor component={Link} to="/my-tasks">← К моим задачам</Anchor>
      <Title order={2}>Карточка задачи</Title>
      <DataPlaceholder description={`Задача ${taskId}: здесь будут данные, доступные действия и история.`} />
    </Stack>
  )
}

function MyTasksPage() {
  return (
    <Stack>
      <Title order={2}>Мои задачи</Title>
      <DataPlaceholder description="Список задач исполнителя появится после подключения схемы данных Supabase." />
    </Stack>
  )
}

function App() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/objects" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<CrmLayout />}>
          <Route path="/" element={<Navigate to="/objects" replace />} />
          <Route path="/objects" element={<ObjectsPage />} />
          <Route path="/objects/:objectId" element={<ObjectPage />} />
          <Route path="/tasks/:taskId" element={<TaskPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={session ? '/objects' : '/login'} replace />} />
    </Routes>
  )
}

export default App
