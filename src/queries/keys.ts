export const queryKeys = {
  objects: {
    all: ['objects'] as const,
    list: (userId: string) => ['objects', 'list', userId] as const,
    detail: (userId: string, objectId: string) => ['objects', 'detail', userId, objectId] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    mine: (userId: string) => ['tasks', 'mine', userId] as const,
    detail: (userId: string, taskId: string) => ['tasks', 'detail', userId, taskId] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    current: (userId: string) => ['profiles', 'current', userId] as const,
    employees: (userId: string) => ['profiles', 'employees', userId] as const,
  },
}
