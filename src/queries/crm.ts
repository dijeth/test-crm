import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { createObject, getObjectDetails, getObjects } from '../services/objects'
import { getEmployees, getProfile } from '../services/profiles'
import { addTaskStatus, createTask, getMyTasks, getTaskDetails, updateTask } from '../services/tasks'
import type { TaskStatus } from '../services/types'
import { queryKeys } from './keys'

export function useObjects() {
  const { session, supabase } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: userId ? queryKeys.objects.list(userId) : queryKeys.objects.all,
    queryFn: () => {
      if (!userId) throw new Error('Не удалось определить пользователя')
      return getObjects()
    },
    enabled: Boolean(supabase && userId),
  })
}

export function useObjectDetails(objectId: string | undefined) {
  const { session, supabase } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: userId && objectId
      ? queryKeys.objects.detail(userId, objectId)
      : queryKeys.objects.all,
    queryFn: () => {
      if (!objectId) throw new Error('Не указан объект')
      return getObjectDetails(objectId)
    },
    enabled: Boolean(supabase && userId && objectId),
  })
}

export function useCreateObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createObject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.objects.all }),
  })
}

export function useMyTasks() {
  const { session, supabase } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: userId ? queryKeys.tasks.mine(userId) : queryKeys.tasks.all,
    queryFn: () => {
      if (!userId) throw new Error('Не удалось определить пользователя')
      return getMyTasks(userId)
    },
    enabled: Boolean(supabase && userId),
  })
}

export function useTaskDetails(taskId: string | undefined) {
  const { session, supabase } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: userId && taskId
      ? queryKeys.tasks.detail(userId, taskId)
      : queryKeys.tasks.all,
    queryFn: () => {
      if (!taskId) throw new Error('Не указана задача')
      return getTaskDetails(taskId, userId)
    },
    enabled: Boolean(supabase && userId && taskId),
  })
}

export function useEmployees(enabled = true) {
  const { session, supabase } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: userId ? queryKeys.profiles.employees(userId) : queryKeys.profiles.all,
    queryFn: getEmployees,
    enabled: Boolean(supabase && userId && enabled),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCurrentProfile() {
  const { session, supabase } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: userId ? queryKeys.profiles.current(userId) : queryKeys.profiles.all,
    queryFn: () => {
      if (!userId) throw new Error('Не удалось определить пользователя')
      return getProfile(userId)
    },
    enabled: Boolean(supabase && userId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateTask(objectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name: string
      description: string
      employeeId: string | null
    }) => createTask({ ...input, objectId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.objects.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      ])
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTask,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.objects.all }),
      ])
    },
  })
}

export function useAddTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addTaskStatus,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.objects.all }),
      ])
    },
  })
}

export type { TaskStatus }
