export type TaskStatus = 'new' | 'in_progress' | 'on_review' | 'accepted' | 'needs_work'

export type ObjectSummary = {
  id: string
  name: string
  address: string
  taskCount: number
  completedTaskCount: number
}

export type ObjectDetails = {
  name: string
  address: string
  owner_id: string
}

export type ObjectTask = {
  id: string
  name: string
  status: TaskStatus
  employeeId: string | null
  employeeName: string | null
  statusUpdatedAt: string | null
}

export type TaskHistoryEntry = {
  id: string
  revision: number
  status: TaskStatus
  changedBy: string
  changedByName: string
  comment: string | null
  createdAt: string
}

export type MyTask = {
  id: string
  name: string
  description: string | null
  status: TaskStatus
  objectName: string | null
  statusAt: string | null
  history: {
    id: string
    revision: number
    status: TaskStatus
    changedByName: string
    comment: string | null
    createdAt: string
  }[]
}

export type TaskDetails = {
  name: string
  description: string | null
  createdAt: string
  objectId: string
  objectName: string
  objectOwnerId: string
  employeeId: string | null
  employeeName: string | null
  status: TaskStatus
}

export type EmployeeOption = { value: string; label: string }

export type UserProfile = {
  role: 'director' | 'employee' | null
  name: string | null
}
