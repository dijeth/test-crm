import { useState, type FormEvent } from 'react'
import { Alert, Anchor, Button, Group, Loader, Modal, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useCreateObject, useObjects } from '../queries/crm'
import type { CrmRouteContext } from '../router/routeContext'

export function ObjectsPage() {
  const { session, supabase } = useAuth()
  const { role } = useOutletContext<CrmRouteContext>()
  const objectsQuery = useObjects()
  const createObjectMutation = useCreateObject()
  const objects = objectsQuery.data ?? []
  const [modalOpened, setModalOpened] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; address?: string }>({})
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
      await createObjectMutation.mutateAsync({
        ownerId: session.user.id,
        name: trimmedName,
        address: trimmedAddress,
      })
      setName('')
      setAddress('')
      setFieldErrors({})
      setModalOpened(false)
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
      {(objectsQuery.error || unavailable) && (
        <Alert color="red">
          {objectsQuery.error instanceof Error
            ? objectsQuery.error.message
            : 'Не удалось подключиться к Supabase'}
        </Alert>
      )}
      {createError && !modalOpened && <Alert color="red">{createError}</Alert>}
      {unavailable ? null : objectsQuery.isPending ? <Loader mx="auto" /> : (
        <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
          <Table miw={760} striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Объект</Table.Th>
                <Table.Th>Адрес</Table.Th>
                <Table.Th>Создал</Table.Th>
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
                  <Table.Td>{object.creatorName ?? '—'}</Table.Td>
                  <Table.Td>{object.taskCount}/{object.completedTaskCount}</Table.Td>
                </Table.Tr>
              ))}
              {objects.length === 0 && !objectsQuery.error && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
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
