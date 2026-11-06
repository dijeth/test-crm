import { useState, type FormEvent } from 'react'
import { Alert, Anchor, Button, Group, Loader, Modal, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useCreateTask, useEmployees, useObjectDetails } from '../queries/crm'
import { StatusBadge } from '../components/StatusBadge'
import type { CrmRouteContext } from '../router/routeContext'

export function ObjectPage() {
  const { objectId } = useParams()
  const { session, supabase } = useAuth()
  const { role } = useOutletContext<CrmRouteContext>()
  const objectQuery = useObjectDetails(objectId)
  const employeesQuery = useEmployees(false)
  const createTaskMutation = useCreateTask(objectId ?? '')
  const object = objectQuery.data?.object ?? null
  const tasks = objectQuery.data?.tasks ?? []
  const employees = employeesQuery.data ?? []
  const [addOpened, setAddOpened] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addEmployeeId, setAddEmployeeId] = useState<string | null>(null)
  const loadingEmployees = employeesQuery.isFetching
  const [addError, setAddError] = useState<string | null>(null)
  const [savingAdd, setSavingAdd] = useState(false)

  async function openAddForm() {
    setAddName('')
    setAddDescription('')
    setAddEmployeeId(null)
    setAddError(null)
    if (!supabase) {
      setAddError('Не удалось подключиться к Supabase')
      return
    }
    try {
      if (employeesQuery.isStale) {
        const result = await employeesQuery.refetch()
        if (result.error) throw result.error
      }
      setAddOpened(true)
    } catch (cause) {
      setAddError(cause instanceof Error ? cause.message : 'Не удалось загрузить список исполнителей')
    }
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
      await createTaskMutation.mutateAsync({
        name,
        description: addDescription.trim(),
        employeeId: addEmployeeId,
      })
      setAddOpened(false)
    } catch (cause) {
      setAddError(cause instanceof Error ? cause.message : 'Не удалось создать задачу')
    } finally {
      setSavingAdd(false)
    }
  }

  return (
    <Stack>
      <Anchor component={Link} to="/objects">← Все объекты</Anchor>
      {objectQuery.isPending ? <Loader mx="auto" /> : (
        <>
          {objectQuery.error && (
            <Alert color="red">
              {objectQuery.error instanceof Error
                ? objectQuery.error.message
                : 'Не удалось загрузить карточку объекта'}
            </Alert>
          )}
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
                      <StatusBadge status={task.status} />
                    </Table.Td>
                    <Table.Td>
                      {task.statusUpdatedAt
                        ? new Date(task.statusUpdatedAt).toLocaleString('ru-RU')
                        : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {tasks.length === 0 && !objectQuery.error && (
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
