import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Table,
  Textarea,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { Link, Navigate, Outlet, Route, Routes, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from './auth/useAuth'

const statusColors: Record<string, string> = {
  new: 'blue',
  in_progress: 'yellow',
  on_review: 'green',
  accepted: 'gray',
  needs_work: 'red',
}

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

function HomeRedirect() {
  const { role } = useOutletContext<{ role: 'director' | 'employee' | null }>()
  if (role === 'director') return <Navigate to="/objects" replace />
  if (role === 'employee') return <Navigate to="/my-tasks" replace />
  return null
}

function RoleRoute({
  role: requiredRole,
  children,
}: {
  role: 'director' | 'employee'
  children: ReactNode
}) {
  const { role } = useOutletContext<{ role: 'director' | 'employee' | null }>()
  if (!role) return null
  if (role !== requiredRole) {
    return <Navigate to={role === 'director' ? '/objects' : '/my-tasks'} replace />
  }
  return children
}

function CrmLayout() {
  const { session, supabase } = useAuth()
  const [profile, setProfile] = useState<{
    userId: string
    role: 'director' | 'employee' | null
    name: string | null
    error: string | null
  } | null>(null)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (!session || !supabase) return () => { active = false }

    supabase
      .from('profiles')
      .select('role, name')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        const role = data?.role === 'director' || data?.role === 'employee' ? data.role : null
        setProfile({
          userId: session.user.id,
          role,
          name: data?.name ?? null,
          error: error?.message ?? (role ? null : 'Не удалось определить роль пользователя'),
        })
      })

    return () => { active = false }
  }, [session, supabase])

  const currentProfile = profile?.userId === session?.user.id ? profile : null
  const role = currentProfile?.role
  const profileName = currentProfile?.name
  const roleError = currentProfile?.error
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
        <Outlet context={{ role }} />
      </Container>
    </Box>
  )
}

function ObjectsPage() {
  const { session, supabase } = useAuth()
  const { role } = useOutletContext<{ role: 'director' | 'employee' | null }>()
  const [objects, setObjects] = useState<{
    id: string
    name: string
    address: string
    taskCount: number
    completedTaskCount: number
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpened, setModalOpened] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; address?: string }>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    if (session && supabase) {
      void (async () => {
        try {
          const { data, error: queryError } = await supabase
            .from('objects')
            .select('id, name, address')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: false })
          if (!active) return
          if (queryError) {
            setError(queryError.message)
          } else if (data.length === 0) {
            setObjects([])
          } else {
            const { data: tasks, error: tasksError } = await supabase
              .from('tasks')
              .select('object_id, status')
              .in('object_id', data.map((object) => object.id))
            if (!active) return
            if (tasksError) {
              setError(tasksError.message)
            } else {
              const taskCounts = new Map<string, { total: number; completed: number }>()
              for (const task of tasks) {
                const counts = taskCounts.get(task.object_id) ?? { total: 0, completed: 0 }
                counts.total += 1
                if (task.status === 'accepted') counts.completed += 1
                taskCounts.set(task.object_id, counts)
              }
              setObjects(data.map((object) => {
                const counts = taskCounts.get(object.id)
                return {
                  ...object,
                  taskCount: counts?.total ?? 0,
                  completedTaskCount: counts?.completed ?? 0,
                }
              }))
            }
          }
        } catch (cause) {
          if (!active) return
          setError(cause instanceof Error ? cause.message : 'Не удалось загрузить объекты')
        }
        if (active) setLoading(false)
      })()
    }

    return () => { active = false }
  }, [session, supabase])

  const unavailable = !session || !supabase

  async function handleCreateObject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedAddress = address.trim()
    const validationErrors = {
      ...(trimmedName ? {} : { name: 'Укажите название объекта' }),
      ...(trimmedAddress ? {} : { address: 'Укажите адрес объекта' }),
    }
    setFieldErrors(validationErrors)
    setCreateError(null)
    if (Object.keys(validationErrors).length > 0) return
    if (!session || !supabase) {
      setCreateError('Не удалось подключиться к Supabase')
      return
    }

    setCreating(true)
    try {
      const { data, error: insertError } = await supabase
        .from('objects')
        .insert({ owner_id: session.user.id, name: trimmedName, address: trimmedAddress })
        .select('id, name, address')
        .single()

      if (insertError) {
        setCreateError(insertError.message)
      } else {
        setObjects((current) => [{
          ...data,
          taskCount: 0,
          completedTaskCount: 0,
        }, ...current])
        setName('')
        setAddress('')
        setFieldErrors({})
        setModalOpened(false)
      }
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Не удалось создать объект')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Объекты</Title>
        {role === 'director' && (
          <Button onClick={() => { setCreateError(null); setModalOpened(true) }}>
            Добавить объект
          </Button>
        )}
      </Group>
      {(error || unavailable) && <Alert color="red">{error ?? 'Не удалось подключиться к Supabase'}</Alert>}
      {createError && !modalOpened && <Alert color="red">{createError}</Alert>}
      {unavailable ? null : loading ? <Loader mx="auto" /> : (
        <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
          <Table miw={620} striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Объект</Table.Th>
                <Table.Th>Адрес</Table.Th>
                <Table.Th>Задачи/Завершенные</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {objects.map((object) => (
                <Table.Tr key={object.id}>
                  <Table.Td>
                    <Anchor component={Link} to={`/objects/${object.id}`}>
                      {object.name}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{object.address}</Table.Td>
                  <Table.Td>{object.taskCount}/{object.completedTaskCount}</Table.Td>
                </Table.Tr>
              ))}
              {objects.length === 0 && !error && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text c="dimmed" ta="center">Объектов пока нет</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Новый объект"
        centered
      >
        <form onSubmit={(event) => void handleCreateObject(event)}>
          <Stack>
            {createError && <Alert color="red">{createError}</Alert>}
            <TextInput
              label="Название объекта"
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value)
                setFieldErrors((current) => ({ ...current, name: undefined }))
              }}
              error={fieldErrors.name}
              required
              autoFocus
            />
            <TextInput
              label="Адрес"
              value={address}
              onChange={(event) => {
                setAddress(event.currentTarget.value)
                setFieldErrors((current) => ({ ...current, address: undefined }))
              }}
              error={fieldErrors.address}
              required
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalOpened(false)}>
                Отмена
              </Button>
              <Button type="submit" loading={creating}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  )
}

function ObjectPage() {
  const { objectId } = useParams()
  const { session, supabase } = useAuth()
  const { role } = useOutletContext<{ role: 'director' | 'employee' | null }>()
  const [object, setObject] = useState<{ name: string; address: string; owner_id: string } | null>(null)
  const [tasks, setTasks] = useState<{
    id: string
    name: string
    status: string
    employeeId: string | null
    employeeName: string | null
    statusUpdatedAt: string | null
  }[]>([])
  const [addOpened, setAddOpened] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addEmployeeId, setAddEmployeeId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [savingAdd, setSavingAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!supabase || !objectId) return () => { active = false }

    void (async () => {
      try {
        const { data: objectData, error: objectError } = await supabase
          .from('objects')
          .select('name, address, owner_id')
          .eq('id', objectId)
          .single()
        if (!active) return
        if (objectError) {
          setError(objectError.message)
          return
        }
        setObject(objectData)

        const { data: taskData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, name, status, employee_id')
          .eq('object_id', objectId)
          .order('created_at', { ascending: false })
        if (!active) return
        if (tasksError) {
          setError(tasksError.message)
          return
        }
        if (taskData.length === 0) {
          setTasks([])
          return
        }

        const assignedIds = [...new Set(
          taskData.flatMap((task) => task.employee_id ? [task.employee_id] : []),
        )]
        const namesById = new Map<string, string>()
        if (assignedIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', assignedIds)
          if (!active) return
          if (profilesError) {
            setError(profilesError.message)
            return
          }
          for (const profile of profiles) namesById.set(profile.id, profile.name)
        }

        const { data: history, error: historyError } = await supabase
          .from('task_status_history')
          .select('task_id, created_at')
          .in('task_id', taskData.map((task) => task.id))
          .order('created_at', { ascending: false })
        if (!active) return
        if (historyError) {
          setError(historyError.message)
          return
        }

        const latestStatusDates = new Map<string, string>()
        for (const entry of history) {
          if (!latestStatusDates.has(entry.task_id)) {
            latestStatusDates.set(entry.task_id, entry.created_at)
          }
        }
        setTasks(taskData.map((task) => ({
          ...task,
          employeeId: task.employee_id,
          employeeName: task.employee_id ? namesById.get(task.employee_id) ?? null : null,
          statusUpdatedAt: latestStatusDates.get(task.id) ?? null,
        })))
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить карточку объекта')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [objectId, supabase])

  async function openAddForm() {
    setAddName('')
    setAddDescription('')
    setAddEmployeeId(null)
    setAddError(null)
    if (!supabase) {
      setAddError('Не удалось подключиться к Supabase')
      return
    }
    setLoadingEmployees(true)
    try {
      const { data, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'employee')
        .order('name')
      if (employeesError) {
        setAddError(employeesError.message)
        return
      }
      setEmployees(data.map((employee) => ({
        value: employee.id,
        label: employee.name || employee.id,
      })))
    } catch (cause) {
      setAddError(cause instanceof Error ? cause.message : 'Не удалось загрузить список исполнителей')
      return
    } finally {
      setLoadingEmployees(false)
    }
    setAddOpened(true)
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !objectId) return

    const name = addName.trim()
    if (!name) {
      setAddError('Укажите название задачи')
      return
    }

    setSavingAdd(true)
    setAddError(null)
    try {
      const { data: created, error: createError } = await supabase.rpc('create_task', {
        p_object_id: objectId,
        p_name: name,
        p_description: addDescription.trim() || undefined,
        p_employee_id: addEmployeeId ?? undefined,
      })
      if (createError) {
        setAddError(createError.message)
        return
      }
      setTasks((current) => [{
        id: created.id,
        name: created.name,
        status: created.status,
        employeeId: created.employee_id,
        employeeName: employees.find((employee) => employee.value === created.employee_id)?.label ?? null,
        statusUpdatedAt: created.created_at,
      }, ...current])
      setAddOpened(false)
    } catch (cause) {
      setAddError(cause instanceof Error ? cause.message : 'Не удалось создать задачу')
    } finally {
      setSavingAdd(false)
    }
  }

  const statusLabels: Record<string, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    on_review: 'На проверке',
    accepted: 'Принята',
    needs_work: 'Требует доработки',
  }

  return (
    <Stack>
      <Anchor component={Link} to="/objects">← Все объекты</Anchor>
      {loading ? <Loader mx="auto" /> : (
        <>
          {error && <Alert color="red">{error}</Alert>}
          <div>
            <Title order={2}>{object?.name ?? 'Карточка объекта'}</Title>
            {object && <Text c="dimmed" mt={4}>{object.address}</Text>}
          </div>
          <Group justify="space-between">
            <Title order={3}>Задачи</Title>
            {role === 'director' && object && session?.user.id === object.owner_id && (
              <Button loading={loadingEmployees} onClick={() => void openAddForm()}>Добавить задачу</Button>
            )}
          </Group>
          <Modal
            opened={addOpened}
            onClose={() => setAddOpened(false)}
            title="Добавить задачу"
            centered
          >
            <form onSubmit={(event) => void handleAddTask(event)}>
              <Stack>
                {addError && <Alert color="red">{addError}</Alert>}
                <TextInput
                  label="Название"
                  value={addName}
                  onChange={(event) => setAddName(event.currentTarget.value)}
                  required
                  maxLength={200}
                />
                <Textarea
                  label="Описание"
                  value={addDescription}
                  onChange={(event) => setAddDescription(event.currentTarget.value)}
                  autosize
                  minRows={3}
                />
                <Select
                  label="Исполнитель"
                  placeholder="Не назначен"
                  searchable
                  clearable
                  data={employees}
                  value={addEmployeeId}
                  onChange={setAddEmployeeId}
                  nothingFoundMessage="Исполнители не найдены"
                />
                <Group justify="flex-end">
                  <Button type="button" variant="default" onClick={() => setAddOpened(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" loading={savingAdd}>Создать</Button>
                </Group>
              </Stack>
            </form>
          </Modal>
          <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
            <Table miw={620} striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Задача</Table.Th>
                  <Table.Th>Исполнитель</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Дата обновления статуса</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tasks.map((task) => (
                  <Table.Tr key={task.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/tasks/${task.id}`}>
                        {task.name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{task.employeeName ?? (task.employeeId ? 'Имя не указано' : 'Не назначен')}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[task.status] ?? 'gray'}>{statusLabels[task.status] ?? task.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {task.statusUpdatedAt
                        ? new Date(task.statusUpdatedAt).toLocaleString('ru-RU')
                        : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {tasks.length === 0 && !error && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text c="dimmed" ta="center">Задач пока нет</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </>
      )}
    </Stack>
  )
}

function TaskPage() {
  const { taskId } = useParams()
  const { session, supabase } = useAuth()
  const { role } = useOutletContext<{ role: 'director' | 'employee' | null }>()
  const [task, setTask] = useState<{
    name: string
    description: string | null
    createdAt: string
    objectId: string
    objectName: string
    objectOwnerId: string
    employeeId: string | null
    employeeName: string | null
    status: string
  } | null>(null)
  const [history, setHistory] = useState<{
    id: string
    revision: number
    status: string
    changedBy: string
    changedByName: string
    comment: string | null
    createdAt: string
  }[]>([])
  const [editOpened, setEditOpened] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [reviewCommentOpened, setReviewCommentOpened] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [submittingStatus, setSubmittingStatus] = useState<'accepted' | 'needs_work' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!supabase || !taskId) return () => { active = false }

    void (async () => {
      try {
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select('id, name, description, created_at, object_id, employee_id, status')
          .eq('id', taskId)
          .single()
        if (!active) return
        if (taskError) {
          setError(taskError.message)
          return
        }

        const { data: objectData, error: objectError } = await supabase
          .from('objects')
          .select('name, owner_id')
          .eq('id', taskData.object_id)
          .single()
        if (!active) return
        if (objectError) {
          setError(objectError.message)
          return
        }

        let employeeName: string | null = null
        if (taskData.employee_id) {
          const { data: employeeProfile, error: employeeError } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', taskData.employee_id)
            .single()
          if (!active) return
          if (employeeError) {
            setError(employeeError.message)
            return
          }
          employeeName = employeeProfile.name
        }

        setTask({
          name: taskData.name,
          description: taskData.description,
          createdAt: taskData.created_at,
          objectId: taskData.object_id,
          objectName: objectData.name,
          objectOwnerId: objectData.owner_id,
          employeeId: taskData.employee_id,
          employeeName,
          status: taskData.status,
        })

        const { data: historyData, error: historyError } = await supabase
          .from('task_status_history')
          .select('id, revision, status, changed_by, comment, created_at')
          .eq('task_id', taskId)
          .order('revision', { ascending: false })
        if (!active) return
        if (historyError) {
          setError(historyError.message)
          return
        }
        const authorIds = [...new Set([
          ...historyData.map((entry) => entry.changed_by),
          ...(session?.user.id ? [session.user.id] : []),
        ])]
        const { data: authors, error: authorsError } = authorIds.length > 0
          ? await supabase.from('profiles').select('id, name').in('id', authorIds)
          : { data: [], error: null }
        if (!active) return
        if (authorsError) {
          setError(authorsError.message)
          return
        }
        const authorNames = new Map(authors.map((author) => [author.id, author.name]))
        setHistory(historyData.map((entry) => ({
          id: entry.id,
          revision: entry.revision,
          status: entry.status,
          changedBy: entry.changed_by,
          changedByName: authorNames.get(entry.changed_by) ?? 'Имя не указано',
          comment: entry.comment,
          createdAt: entry.created_at,
        })))
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Не удалось загрузить карточку задачи')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [supabase, taskId, role, session])

  async function openEditForm() {
    if (!task) return
    setEditName(task.name)
    setEditDescription(task.description ?? '')
    setEditEmployeeId(task.employeeId)
    setEditError(null)
    if (task.status === 'new') {
      if (!supabase) {
        setEditError('Не удалось подключиться к Supabase')
        return
      }
      setLoadingEmployees(true)
      try {
        const { data, error: employeesError } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('role', 'employee')
          .order('name')
        if (employeesError) {
          setEditError(employeesError.message)
          return
        }
        setEmployees(data.map((employee) => ({
          value: employee.id,
          label: employee.name || employee.id,
        })))
      } catch (cause) {
        setEditError(cause instanceof Error ? cause.message : 'Не удалось загрузить список исполнителей')
        return
      } finally {
        setLoadingEmployees(false)
      }
    }
    setEditOpened(true)
  }

  async function handleEditTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !taskId || !task) return

    const name = editName.trim()
    if (!name) {
      setEditError('Укажите название задачи')
      return
    }
    if (task.status === 'new' && editEmployeeId
      && !employees.some((employee) => employee.value === editEmployeeId)) {
      setEditError('Выберите исполнителя из списка')
      return
    }

    setSavingEdit(true)
    setEditError(null)
    try {
      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update({
          name,
          description: editDescription.trim() || null,
          ...(task.status === 'new' ? { employee_id: editEmployeeId } : {}),
        })
        .eq('id', taskId)
        .select('id')
        .maybeSingle()
      if (updateError) {
        setEditError(updateError.message)
      } else if (!updatedTask) {
        setEditError('Не удалось изменить задачу: нет прав на изменение или задача недоступна')
      } else {
        setTask((current) => current
          ? {
            ...current,
            name,
            description: editDescription.trim() || null,
            ...(task.status === 'new'
              ? {
                employeeId: editEmployeeId,
                employeeName: employees.find((employee) => employee.value === editEmployeeId)?.label ?? null,
              }
              : {}),
          }
          : current)
        setEditOpened(false)
      }
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Не удалось изменить задачу')
    } finally {
      setSavingEdit(false)
    }
  }

  async function submitReview(status: 'accepted' | 'needs_work', comment: string | null = null) {
    if (!supabase || !session || !taskId || !task || role !== 'director' || task.status !== 'on_review') return
    if (status === 'needs_work' && !comment?.trim()) {
      setReviewError('Укажите комментарий с причиной доработки')
      return
    }

    setSubmittingStatus(status)
    setReviewError(null)
    try {
      const revision = (history[0]?.revision ?? 0) + 1
      const { data: entry, error: insertError } = await supabase
        .from('task_status_history')
        .insert({
          task_id: taskId,
          revision,
          status,
          changed_by: session.user.id,
          comment: comment?.trim() || null,
        })
        .select('id, revision, status, changed_by, comment, created_at')
        .single()
      if (insertError) {
        setReviewError(insertError.message)
        return
      }

      const ownName = history.find((item) => item.changedBy === session.user.id)?.changedByName
        ?? 'Вы'
      setHistory((current) => [{
        id: entry.id,
        revision: entry.revision,
        status: entry.status,
        changedBy: entry.changed_by,
        changedByName: ownName,
        comment: entry.comment,
        createdAt: entry.created_at,
      }, ...current])
      setTask((current) => current ? { ...current, status } : current)
      setReviewComment('')
      setReviewCommentOpened(false)
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : 'Не удалось обновить статус задачи')
    } finally {
      setSubmittingStatus(null)
    }
  }

  const statusLabels: Record<string, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    on_review: 'На проверке',
    accepted: 'Принята',
    needs_work: 'Требует доработки',
  }

  return (
    <Stack>
      <Anchor component={Link} to={task ? `/objects/${task.objectId}` : '/my-tasks'}>
        {task ? `← ${task.objectName}` : '← К моим задачам'}
      </Anchor>
      {loading ? <Loader mx="auto" /> : (
        <>
          {error && <Alert color="red">{error}</Alert>}
          {task && (
            <>
              <div>
                <Title order={1}>{task.name}</Title>
                <Text c="dimmed" size="sm" mt="xs">
                  Создана {new Date(task.createdAt).toLocaleString('ru-RU')}
                </Text>
                {task.description && <Text mt="md">{task.description}</Text>}
                <Text c="dimmed" size="sm" mt="xs">
                  Исполнитель: {task.employeeName ?? (task.employeeId ? 'Имя не указано' : 'Не назначен')}
                </Text>
              </div>
              <Group>
                {role === 'director' && (
                  <>
                    {session?.user.id === task.objectOwnerId && task.status === 'new' && (
                      <Button variant="default" onClick={() => void openEditForm()}>Изменить</Button>
                    )}
                    <Button
                      color="green"
                      disabled={task.status !== 'on_review' || submittingStatus !== null}
                      loading={submittingStatus === 'accepted'}
                      onClick={() => void submitReview('accepted')}
                    >
                      Принять
                    </Button>
                    <Button
                      color="red"
                      disabled={task.status !== 'on_review' || submittingStatus !== null}
                      loading={submittingStatus === 'needs_work'}
                      onClick={() => {
                        setReviewError(null)
                        setReviewCommentOpened(true)
                      }}
                    >
                      На доработку
                    </Button>
                  </>
                )}
                {reviewError && !reviewCommentOpened && (
                  <Alert color="red" w="100%">{reviewError}</Alert>
                )}
              </Group>
              <Title order={3}>История статусов</Title>
              <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
                <Table miw={680} striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Дата</Table.Th>
                      <Table.Th>Статус</Table.Th>
                      <Table.Th>Изменил</Table.Th>
                      <Table.Th>Комментарий</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {history.map((entry, index) => (
                      <Table.Tr key={entry.id}>
                      <Table.Td c={index === 0 ? undefined : 'dimmed'}>
                        {new Date(entry.createdAt).toLocaleString('ru-RU')}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={statusColors[entry.status] ?? 'gray'}
                          variant={index === 0 ? 'filled' : 'light'}
                        >
                          {statusLabels[entry.status] ?? entry.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td c={index === 0 ? undefined : 'dimmed'}>{entry.changedByName}</Table.Td>
                      <Table.Td c={index === 0 ? undefined : 'dimmed'}>{entry.comment ?? '—'}</Table.Td>
                    </Table.Tr>
                    ))}
                    {history.length === 0 && !error && (
                      <Table.Tr>
                        <Table.Td colSpan={4}>
                          <Text c="dimmed" ta="center">История статусов пуста</Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>
              <Modal
                opened={editOpened}
                onClose={() => setEditOpened(false)}
                title="Изменить задачу"
                centered
              >
                <form onSubmit={(event) => void handleEditTask(event)}>
                  <Stack>
                    {editError && <Alert color="red">{editError}</Alert>}
                    <TextInput
                      label="Название"
                      value={editName}
                      onChange={(event) => setEditName(event.currentTarget.value)}
                      required
                      maxLength={200}
                    />
                    <Textarea
                      label="Описание"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.currentTarget.value)}
                      autosize
                      minRows={3}
                    />
                    {task.status === 'new' && (
                      <Select
                        label="Исполнитель"
                        placeholder="Не назначен"
                        searchable
                        clearable
                        data={employees}
                        value={editEmployeeId}
                        onChange={setEditEmployeeId}
                        nothingFoundMessage="Исполнители не найдены"
                        disabled={loadingEmployees}
                      />
                    )}
                    <Group justify="flex-end">
                      <Button type="button" variant="default" onClick={() => setEditOpened(false)}>
                        Отмена
                      </Button>
                      <Button type="submit" loading={savingEdit}>Сохранить</Button>
                    </Group>
                  </Stack>
                </form>
              </Modal>
              <Modal
                opened={reviewCommentOpened}
                onClose={() => setReviewCommentOpened(false)}
                title="Вернуть задачу на доработку"
                centered
              >
                <Stack>
                  {reviewError && <Alert color="red">{reviewError}</Alert>}
                  <Textarea
                    label="Причина доработки"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.currentTarget.value)}
                    required
                    autosize
                    minRows={3}
                  />
                  <Group justify="flex-end">
                    <Button variant="default" onClick={() => setReviewCommentOpened(false)}>
                      Отмена
                    </Button>
                    <Button
                      color="red"
                      loading={submittingStatus === 'needs_work'}
                      onClick={() => void submitReview('needs_work', reviewComment)}
                    >
                      Вернуть на доработку
                    </Button>
                  </Group>
                </Stack>
              </Modal>
            </>
          )}
        </>
      )}
    </Stack>
  )
}

function MyTasksPage() {
  const { session, supabase } = useAuth()
  const [tasks, setTasks] = useState<{
    id: string
    name: string
    description: string | null
    status: string
    objectName: string | null
    statusAt: string | null
    history: {
      id: string
      revision: number
      status: string
      changedByName: string
      comment: string | null
      createdAt: string
    }[]
  }[]>([])
  const [selectedTask, setSelectedTask] = useState<typeof tasks[number] | null>(null)
  const [loading, setLoading] = useState(Boolean(session && supabase))
  const [error, setError] = useState<string | null>(null)
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (session && supabase) {
      void (async () => {
        try {
          const { data, error: queryError } = await supabase
            .from('tasks')
            .select('id, name, description, status, object_id')
            .eq('employee_id', session.user.id)
            .order('created_at', { ascending: false })
          if (!active) return
          if (queryError) {
            setError(queryError.message)
            setTasks([])
          } else if (data.length === 0) {
            setTasks([])
          } else {
            const taskIds = data.map((task) => task.id)
            const [objectsResult, historyResult] = await Promise.all([
              supabase
                .from('objects')
                .select('id, name')
                .in('id', data.map((task) => task.object_id)),
              supabase
                .from('task_status_history')
                .select('id, task_id, revision, status, changed_by, comment, created_at')
                .in('task_id', taskIds)
                .order('revision', { ascending: false }),
            ])
            if (!active) return
            if (objectsResult.error) {
              setError(objectsResult.error.message)
              setTasks([])
              return
            }
            if (historyResult.error) {
              setError(historyResult.error.message)
              setTasks([])
              return
            }

            const authorIds = [...new Set(historyResult.data.map((entry) => entry.changed_by))]
            const { data: authors, error: authorsError } = authorIds.length > 0
              ? await supabase.from('profiles').select('id, name').in('id', authorIds)
              : { data: [], error: null }
            if (!active) return
            if (authorsError) {
              setError(authorsError.message)
              setTasks([])
              return
            }

            const namesById = new Map(objectsResult.data.map((object) => [object.id, object.name]))
            const authorNames = new Map(authors.map((author) => [author.id, author.name]))
            const historyByTask = new Map<string, typeof historyResult.data>()
            for (const entry of historyResult.data) {
              const entries = historyByTask.get(entry.task_id) ?? []
              entries.push(entry)
              historyByTask.set(entry.task_id, entries)
            }
            setTasks(data.map((task) => {
              const taskHistory = historyByTask.get(task.id) ?? []
              return {
                id: task.id,
                name: task.name,
                description: task.description,
                status: task.status,
                objectName: namesById.get(task.object_id) ?? null,
                statusAt: taskHistory[0]?.created_at ?? null,
                history: taskHistory.map((entry) => ({
                  id: entry.id,
                  revision: entry.revision,
                  status: entry.status,
                  changedByName: authorNames.get(entry.changed_by) ?? 'Имя не указано',
                  comment: entry.comment,
                  createdAt: entry.created_at,
                })),
              }
            }))
          }
        } catch (cause) {
          if (!active) return
          setError(cause instanceof Error ? cause.message : 'Не удалось загрузить задачи')
          setTasks([])
        } finally {
          if (active) setLoading(false)
        }
      })()
    }

    return () => { active = false }
  }, [session, supabase])

  const statusLabels: Record<string, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    on_review: 'На проверке',
    accepted: 'Принята',
    needs_work: 'Требует доработки',
  }

  async function changeTaskStatus(task: typeof tasks[number]) {
    if (!supabase || !session || submittingTaskId) return
    const status = task.status === 'new' || task.status === 'needs_work'
      ? 'in_progress'
      : task.status === 'in_progress'
        ? 'on_review'
        : null
    if (!status) return

    setSubmittingTaskId(task.id)
    setError(null)
    try {
      const { data: entry, error: insertError } = await supabase
        .from('task_status_history')
        .insert({
          task_id: task.id,
          revision: (task.history[0]?.revision ?? 0) + 1,
          status,
          changed_by: session.user.id,
        })
        .select('id, revision, status, changed_by, comment, created_at')
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }

      const nextHistoryEntry = {
        id: entry.id,
        revision: entry.revision,
        status: entry.status,
        changedByName: 'Вы',
        comment: entry.comment,
        createdAt: entry.created_at,
      }
      const updateTask = (current: typeof tasks[number]) => ({
        ...current,
        status,
        statusAt: entry.created_at,
        history: [nextHistoryEntry, ...current.history],
      })
      setTasks((current) => current.map((item) => item.id === task.id ? updateTask(item) : item))
      setSelectedTask((current) => current?.id === task.id ? updateTask(current) : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось обновить статус задачи')
    } finally {
      setSubmittingTaskId(null)
    }
  }

  return (
    <Stack>
      <Title order={2}>Мои задачи</Title>
      {(error || (!session || !supabase)) && (
        <Alert color="red">{error ?? 'Не удалось подключиться к Supabase'}</Alert>
      )}
      {!session || !supabase ? null : loading ? <Loader mx="auto" /> : (
        <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
          <Table miw={900} striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Объект</Table.Th>
                <Table.Th>Задача</Table.Th>
                <Table.Th>Дата статуса</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tasks.map((task) => (
                <Table.Tr key={task.id}>
                  <Table.Td>{task.objectName ?? '—'}</Table.Td>
                  <Table.Td>{task.name}</Table.Td>
                  <Table.Td>
                    {task.statusAt ? new Date(task.statusAt).toLocaleString('ru-RU') : '—'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColors[task.status] ?? 'gray'}>
                      {statusLabels[task.status] ?? task.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button variant="default" onClick={() => setSelectedTask(task)}>
                        Описание
                      </Button>
                      {(task.status === 'new' || task.status === 'needs_work') && (
                        <Button
                          color="green"
                          loading={submittingTaskId === task.id}
                          disabled={submittingTaskId !== null}
                          onClick={() => void changeTaskStatus(task)}
                        >
                          Взять в работу
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          color="blue"
                          loading={submittingTaskId === task.id}
                          disabled={submittingTaskId !== null}
                          onClick={() => void changeTaskStatus(task)}
                        >
                          На проверку
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {tasks.length === 0 && !error && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center">Назначенных задач пока нет</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      <Modal
        opened={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.name}
        centered
        size="lg"
      >
        {selectedTask && (
          <Stack>
            <Group justify="space-between">
              <Text c="dimmed">{selectedTask.objectName ?? 'Объект не указан'}</Text>
              <Badge color={statusColors[selectedTask.status] ?? 'gray'}>
                {statusLabels[selectedTask.status] ?? selectedTask.status}
              </Badge>
            </Group>
            <Text>{selectedTask.description || 'Описание не указано'}</Text>
            {selectedTask.history[0]?.comment && (
              <div>
                <Text size="sm" fw={600}>Комментарий к последнему статусу</Text>
                <Text>{selectedTask.history[0].comment}</Text>
              </div>
            )}
            <Title order={4}>История статусов</Title>
            <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
              <Table miw={540} striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Дата</Table.Th>
                    <Table.Th>Статус</Table.Th>
                    <Table.Th>Изменил</Table.Th>
                    <Table.Th>Комментарий</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedTask.history.map((entry) => (
                    <Table.Tr key={entry.id}>
                      <Table.Td>{new Date(entry.createdAt).toLocaleString('ru-RU')}</Table.Td>
                      <Table.Td>
                        <Badge color={statusColors[entry.status] ?? 'gray'}>
                          {statusLabels[entry.status] ?? entry.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{entry.changedByName}</Table.Td>
                      <Table.Td>{entry.comment ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                  {selectedTask.history.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed" ta="center">История статусов пуста</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Paper>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}

function App() {
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

export default App
