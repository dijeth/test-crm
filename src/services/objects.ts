import { requireSupabase } from './supabase'
import type { ObjectDetails, ObjectSummary, ObjectTask } from './types'

export async function getObjects(): Promise<ObjectSummary[]> {
  const client = requireSupabase()
  const { data: objects, error } = await client
    .from('objects')
    .select('id, name, address, owner_id')
    .order('created_at', { ascending: false })
  if (error) throw error
  if (objects.length === 0) return []

  const [tasksResult, profilesResult] = await Promise.all([
    client
      .from('tasks')
      .select('object_id, status')
      .in('object_id', objects.map((object) => object.id)),
    client
      .from('profiles')
      .select('id, name')
      .in('id', [...new Set(objects.map((object) => object.owner_id))]),
  ])
  if (tasksResult.error) throw tasksResult.error
  if (profilesResult.error) throw profilesResult.error

  const counts = new Map<string, { total: number; completed: number }>()
  for (const task of tasksResult.data) {
    const current = counts.get(task.object_id) ?? { total: 0, completed: 0 }
    current.total += 1
    if (task.status === 'accepted') current.completed += 1
    counts.set(task.object_id, current)
  }

  const namesById = new Map(profilesResult.data.map((profile) => [profile.id, profile.name]))
  return objects.map((object) => {
    const count = counts.get(object.id)
    return {
      id: object.id,
      name: object.name,
      address: object.address,
      creatorName: namesById.get(object.owner_id) ?? null,
      taskCount: count?.total ?? 0,
      completedTaskCount: count?.completed ?? 0,
    }
  })
}

export async function getObjectDetails(objectId: string): Promise<{
  object: ObjectDetails
  tasks: ObjectTask[]
}> {
  const client = requireSupabase()
  const { data: object, error: objectError } = await client
    .from('objects')
    .select('name, address, owner_id')
    .eq('id', objectId)
    .single()
  if (objectError) throw objectError

  const { data: tasks, error: tasksError } = await client
    .from('tasks')
    .select('id, name, status, employee_id')
    .eq('object_id', objectId)
    .order('created_at', { ascending: false })
  if (tasksError) throw tasksError
  if (tasks.length === 0) return { object, tasks: [] }

  const assignedIds = [...new Set(
    tasks.flatMap((task) => task.employee_id ? [task.employee_id] : []),
  )]
  const taskIds = tasks.map((task) => task.id)
  const [profilesResult, historyResult] = await Promise.all([
    assignedIds.length
      ? client.from('profiles').select('id, name').in('id', assignedIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from('task_status_history')
      .select('task_id, created_at')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false }),
  ])
  if (profilesResult.error) throw profilesResult.error
  if (historyResult.error) throw historyResult.error

  const namesById = new Map(profilesResult.data.map((profile) => [profile.id, profile.name]))
  const latestStatusDates = new Map<string, string>()
  for (const entry of historyResult.data) {
    if (!latestStatusDates.has(entry.task_id)) latestStatusDates.set(entry.task_id, entry.created_at)
  }

  return {
    object,
    tasks: tasks.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      employeeId: task.employee_id,
      employeeName: task.employee_id ? namesById.get(task.employee_id) ?? null : null,
      statusUpdatedAt: latestStatusDates.get(task.id) ?? null,
    })),
  }
}

export async function createObject(input: {
  ownerId: string
  name: string
  address: string
}): Promise<ObjectSummary> {
  const { data, error } = await requireSupabase()
    .from('objects')
    .insert({ owner_id: input.ownerId, name: input.name, address: input.address })
    .select('id, name, address')
    .single()
  if (error) throw error
  return { ...data, creatorName: null, taskCount: 0, completedTaskCount: 0 }
}
