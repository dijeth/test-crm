import { useState } from 'react'
import { Alert, Button, Group, Loader, Modal, Paper, Stack, Table, Text, Title } from '@mantine/core'
import { useAuth } from '../auth/useAuth'
import { useAddTaskStatus, useMyTasks } from '../queries/crm'
import type { MyTask } from '../services/types'
import { StatusBadge } from '../components/StatusBadge'

export function MyTasksPage() {
  const { session, supabase } = useAuth()
  const tasksQuery = useMyTasks()
  const addTaskStatus = useAddTaskStatus()
  const tasks = tasksQuery.data ?? []
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask: MyTask | null = tasks.find((task) => task.id === selectedTaskId) ?? null
  const [error, setError] = useState<string | null>(null)
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null)

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
      await addTaskStatus.mutateAsync({
        taskId: task.id,
        revision: (task.history[0]?.revision ?? 0) + 1,
        status,
        changedBy: session.user.id,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось обновить статус задачи')
    } finally {
      setSubmittingTaskId(null)
    }
  }

  return (
    <Stack>
      <Title order={2}>Мои задачи</Title>
      {(error || tasksQuery.error || (!session || !supabase)) && (
        <Alert color="red">
          {error ?? (tasksQuery.error instanceof Error
            ? tasksQuery.error.message
            : 'Не удалось подключиться к Supabase')}
        </Alert>
      )}
      {!session || !supabase ? null : tasksQuery.isPending ? <Loader mx="auto" /> : (
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
                    <StatusBadge status={task.status} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button variant="default" onClick={() => setSelectedTaskId(task.id)}>
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
              {tasks.length === 0 && !error && !tasksQuery.error && (
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
        onClose={() => setSelectedTaskId(null)}
        title={selectedTask?.name}
        centered
        size="lg"
      >
        {selectedTask && (
          <Stack>
            <Group justify="space-between">
              <Text c="dimmed">{selectedTask.objectName ?? 'Объект не указан'}</Text>
              <StatusBadge status={selectedTask.status} />
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
                  {selectedTask.history.map((entry, index) => (
                    <Table.Tr key={entry.id}>
                      <Table.Td>{new Date(entry.createdAt).toLocaleString('ru-RU')}</Table.Td>
                      <Table.Td>
                        <StatusBadge status={entry.status} disabled={index !== 0} />
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
