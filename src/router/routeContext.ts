export type UserRole = 'director' | 'employee' | null

export type CrmRouteContext = {
  role: UserRole
}
