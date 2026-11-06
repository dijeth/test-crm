import { useState, type FormEvent } from 'react'
import { Alert, Anchor, Button, Group, Loader, Modal, Paper, Select, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useAddTaskStatus, useEmployees, useTaskDetails, useUpdateTask } from '../queries/crm'
import { StatusBadge } from '../components/StatusBadge'
import type { CrmRouteContext } from '../router/routeContext'

export function TaskPage() {
  const { taskId } = useParams()
  const { session, supabase } = useAuth()
  const { role } = useOutletContext<CrmRouteContext>()
  const taskQuery = useTaskDetails(taskId)
  const employeesQuery = useEmployees(false)
  const updateTaskMutation = useUpdateTask()
  const addTaskStatus = useAddTaskStatus()
  const task = taskQuery.data?.task ?? null
  const history = taskQuery.data?.history ?? []
  const employees = employeesQuery.data ?? []
  const [editOpened, setEditOpened] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null)
  const loadingEmployees = employeesQuery.isFetching
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [reviewCommentOpened, setReviewCommentOpened] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [submittingStatus, setSubmittingStatus] = useState<'accepted' | 'needs_work' | null>(null)

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
      try {
        if (!employeesQuery.data || employeesQuery.isStale) {
          const result = await employeesQuery.refetch()
          if (result.error) throw result.error
        }
      } catch (cause) {
        setEditError(cause instanceof Error ? cause.message : 'Не удалось загрузить список исполнителей')
        return
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
      await updateTaskMutation.mutateAsync({
        taskId,
        name,
        description: editDescription.trim(),
        employeeId: editEmployeeId,
        editableAssignment: task.status === 'new',
      })
      setEditOpened(false)
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
      await addTaskStatus.mutateAsync({
        taskId,
        revision: (history[0]?.revision ?? 0) + 1,
        status,
        changedBy: session.user.id,
        comment,
      })
      setReviewComment('')
      setReviewCommentOpened(false)
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : 'Не удалось обновить статус задачи')
    } finally {
      setSubmittingStatus(null)
    }
  }

  return (
    <Stack>
      <Anchor component={Link} to={task ? `/objects/${task.objectId}` : '/my-tasks'}>
        {task ? `← ${task.objectName}` : '← К моим задачам'}
      </Anchor>
      {taskQuery.isPending ? <Loader mx="auto" /> : (
        <>
          {taskQuery.error && (
            <Alert color="red">
              {taskQuery.error instanceof Error
                ? taskQuery.error.message
                : 'Не удалось загрузить карточку задачи'}
            </Alert>
          )}
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
                        <StatusBadge status={entry.status} disabled={index !== 0} />
                      </Table.Td>
                      <Table.Td c={index === 0 ? undefined : 'dimmed'}>{entry.changedByName}</Table.Td>
                      <Table.Td c={index === 0 ? undefined : 'dimmed'}>{entry.comment ?? '—'}</Table.Td>
                    </Table.Tr>
                    ))}
                    {history.length === 0 && !taskQuery.error && (
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
