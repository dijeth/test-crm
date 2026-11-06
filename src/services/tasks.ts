import { requireSupabase } from './supabase'
import type { MyTask, TaskDetails, TaskHistoryEntry, TaskStatus } from './types'

export async function getMyTasks(userId: string): Promise<MyTask[]> {
  const client = requireSupabase()
  const { data: tasks, error } = await client
    .from('tasks')
    .select('id, name, description, status, object_id')
    .eq('employee_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (tasks.length === 0) return []

  const taskIds = tasks.map((task) => task.id)
  const [objectsResult, historyResult] = await Promise.all([
    client.from('objects').select('id, name').in('id', tasks.map((task) => task.object_id)),
    client
      .from('task_status_history')
      .select('id, task_id, revision, status, changed_by, comment, created_at')
      .in('task_id', taskIds)
      .order('revision', { ascending: false }),
  ])
  if (objectsResult.error) throw objectsResult.error
  if (historyResult.error) throw historyResult.error

  const authorIds = [...new Set(historyResult.data.map((entry) => entry.changed_by))]
  const { data: authors, error: authorsError } = authorIds.length
    ? await client.from('profiles').select('id, name').in('id', authorIds)
    : { data: [], error: null }
  if (authorsError) throw authorsError

  const namesById = new Map(objectsResult.data.map((object) => [object.id, object.name]))
  const authorNames = new Map(authors.map((author) => [author.id, author.name]))
  const historyByTask = new Map<string, typeof historyResult.data>()
  for (const entry of historyResult.data) {
    const entries = historyByTask.get(entry.task_id) ?? []
    entries.push(entry)
    historyByTask.set(entry.task_id, entries)
  }

  return tasks.map((task) => {
    const history = historyByTask.get(task.id) ?? []
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      objectName: namesById.get(task.object_id) ?? null,
      statusAt: history[0]?.created_at ?? null,
      history: history.map((entry) => ({
        id: entry.id,
        revision: entry.revision,
        status: entry.status,
        changedByName: authorNames.get(entry.changed_by) ?? 'Имя не указано',
        comment: entry.comment,
        createdAt: entry.created_at,
      })),
    }
  })
}

export async function getTaskDetails(taskId: string, currentUserId: string | undefined): Promise<{
  task: TaskDetails
  history: TaskHistoryEntry[]
}> {
  const client = requireSupabase()
  const { data: task, error: taskError } = await client
    .from('tasks')
    .select('id, name, description, created_at, object_id, employee_id, status')
    .eq('id', taskId)
    .single()
  if (taskError) throw taskError

  const [objectResult, historyResult, employeeResult] = await Promise.all([
    client.from('objects').select('name, owner_id').eq('id', task.object_id).single(),
    client
      .from('task_status_history')
      .select('id, revision, status, changed_by, comment, created_at')
      .eq('task_id', taskId)
      .order('revision', { ascending: false }),
    task.employee_id
      ? client.from('profiles').select('name').eq('id', task.employee_id).single()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (objectResult.error) throw objectResult.error
  if (historyResult.error) throw historyResult.error
  if (employeeResult.error) throw employeeResult.error

  const authorIds = [...new Set([
    ...historyResult.data.map((entry) => entry.changed_by),
    ...(currentUserId ? [currentUserId] : []),
  ])]
  const { data: authors, error: authorsError } = authorIds.length
    ? await client.from('profiles').select('id, name').in('id', authorIds)
    : { data: [], error: null }
  if (authorsError) throw authorsError
  const namesById = new Map(authors.map((author) => [author.id, author.name]))

  return {
    task: {
      name: task.name,
      description: task.description,
      createdAt: task.created_at,
      objectId: task.object_id,
      objectName: objectResult.data.name,
      objectOwnerId: objectResult.data.owner_id,
      employeeId: task.employee_id,
      employeeName: employeeResult.data?.name ?? null,
      status: task.status,
    },
    history: historyResult.data.map((entry) => ({
      id: entry.id,
      revision: entry.revision,
      status: entry.status,
      changedBy: entry.changed_by,
      changedByName: namesById.get(entry.changed_by) ?? 'Имя не указано',
      comment: entry.comment,
      createdAt: entry.created_at,
    })),
  }
}

export async function createTask(input: {
  objectId: string
  name: string
  description: string
  employeeId: string | null
}) {
  const { data, error } = await requireSupabase().rpc('create_task', {
    p_object_id: input.objectId,
    p_name: input.name,
    p_description: input.description || undefined,
    p_employee_id: input.employeeId ?? undefined,
  })
  if (error) throw error
  return data
}

export async function updateTask(input: {
  taskId: string
  name: string
  description: string
  employeeId: string | null
  editableAssignment: boolean
}) {
  const { data, error } = await requireSupabase()
    .from('tasks')
    .update({
      name: input.name,
      description: input.description || null,
      ...(input.editableAssignment ? { employee_id: input.employeeId } : {}),
    })
    .eq('id', input.taskId)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Не удалось изменить задачу: нет прав на изменение или задача недоступна')
}

export async function addTaskStatus(input: {
  taskId: string
  revision: number
  status: TaskStatus
  changedBy: string
  comment?: string | null
}): Promise<Omit<TaskHistoryEntry, 'changedByName'>> {
  const { data, error } = await requireSupabase()
    .from('task_status_history')
    .insert({
      task_id: input.taskId,
      revision: input.revision,
      status: input.status,
      changed_by: input.changedBy,
      comment: input.comment?.trim() || null,
    })
    .select('id, revision, status, changed_by, comment, created_at')
    .single()
  if (error) throw error
  return {
    id: data.id,
    revision: data.revision,
    status: data.status,
    changedBy: data.changed_by,
    comment: data.comment,
    createdAt: data.created_at,
  }
}
