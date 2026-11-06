import { Badge } from '@mantine/core'

const statusColors: Record<string, string> = {
  new: 'blue',
  in_progress: 'yellow',
  on_review: 'green',
  accepted: 'gray',
  needs_work: 'red',
}

const statusLabels: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  on_review: 'На проверке',
  accepted: 'Принята',
  needs_work: 'Требует доработки',
}

type StatusBadgeProps = {
  status: string
  disabled?: boolean
}

export function StatusBadge({ status, disabled = false }: StatusBadgeProps) {
  return (
    <Badge
      color={statusColors[status] ?? 'gray'}
      variant={disabled ? 'light' : 'filled'}
      style={{ opacity: disabled ? 0.7 : 1 }}
    >
      {statusLabels[status] ?? status}
    </Badge>
  )
}
