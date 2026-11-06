import { useState, type FormEvent } from 'react'
import { Alert, Button, Container, PasswordInput, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { useAuth } from '../auth/useAuth'

export function LoginPage() {
  const { supabase, error: authError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setSubmitting(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) setError(signInError.message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить вход')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container size={420} py="xl">
      <Paper withBorder p="xl" radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            <div>
              <Title order={2}>Вход в CRM</Title>
              <Text c="dimmed" size="sm" mt={4}>Войдите с рабочей учётной записью</Text>
            </div>
            {!supabase && (
              <Alert color="yellow" title="Supabase не настроен">
                Скопируйте .env.example в .env.local и укажите URL и публичный ключ проекта.
              </Alert>
            )}
            {(error || authError) && <Alert color="red">{error || authError}</Alert>}
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Пароль"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <Button type="submit" loading={submitting} disabled={!supabase}>
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}
