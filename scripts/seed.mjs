import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { seedObjects, seedTasks } from './seed-task-data.mjs'

async function loadSeedEnv() {
  try {
    const contents = await readFile('.env.seed.local', 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match || match[1] in process.env) continue

      const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
      process.env[match[1]] = value
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}; set it in .env.seed.local or the environment`)
  return value
}

function failIfError(error, operation) {
  if (error) throw new Error(`${operation}: ${error.message}`)
}

await loadSeedEnv()

const supabaseUrl = requireEnv('SUPABASE_URL')
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
if (!publishableKey) {
  throw new Error('Missing SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY)')
}
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const password = requireEnv('SEED_PASSWORD')

if (password.length < 12) {
  throw new Error('SEED_PASSWORD must be at least 12 characters')
}

const projectHost = new URL(supabaseUrl).hostname
const isLocalProject = ['localhost', '127.0.0.1'].includes(projectHost)
if (!isLocalProject && process.env.SEED_CONFIRM_REMOTE !== 'yes') {
  throw new Error(
    `Target is remote (${projectHost}). Set SEED_CONFIRM_REMOTE=yes to confirm this is the intended project.`,
  )
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const directors = [
  { email: 'director1@crm.test', name: 'Директор 1', role: 'director' },
  { email: 'director2@crm.test', name: 'Директор 2', role: 'director' },
]
const employees = Array.from({ length: 5 }, (_, index) => ({
  email: `employee${index + 1}@crm.test`,
  name: `Исполнитель ${index + 1}`,
  role: 'employee',
}))
const users = [...directors, ...employees]

async function listUsers() {
  const allUsers = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    failIfError(error, 'Could not list Auth users')
    allUsers.push(...data.users)
    if (data.users.length < 1000) return allUsers
  }
}

const existingUsers = new Map((await listUsers()).map((user) => [user.email, user]))
const userIds = new Map()

for (const user of users) {
  const existing = existingUsers.get(user.email)
  let authUser

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { seeded: true, role: user.role, name: user.name },
    })
    failIfError(error, `Could not update ${user.email}`)
    authUser = data.user
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { seeded: true, role: user.role, name: user.name },
    })
    failIfError(error, `Could not create ${user.email}`)
    authUser = data.user
  }

  userIds.set(user.email, authUser.id)
}

const profileRows = users.map((user) => ({
  id: userIds.get(user.email),
  name: user.name,
  role: user.role,
}))
const { error: profilesError } = await admin
  .from('profiles')
  .upsert(profileRows, { onConflict: 'id' })
failIfError(profilesError, 'Could not seed profiles')

const objects = [
  {
    ...seedObjects[0],
    owner_id: userIds.get('director1@crm.test'),
    name: 'Жилой комплекс «Северный»',
    address: 'Москва, Северная улица, 10',
  },
  {
    ...seedObjects[1],
    owner_id: userIds.get('director1@crm.test'),
    name: 'Офисный центр «Речной»',
    address: 'Москва, Набережная улица, 25',
  },
  {
    ...seedObjects[2],
    owner_id: userIds.get('director2@crm.test'),
    name: 'Складской комплекс «Восток»',
    address: 'Москва, Восточное шоссе, 7',
  },
]

const { error: objectsError } = await admin
  .from('objects')
  .upsert(objects, { onConflict: 'id' })
failIfError(objectsError, 'Could not seed objects')

for (const object of objects) {
  const director = directors.find((user) => userIds.get(user.email) === object.owner_id)
  const directorClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await directorClient.auth.signInWithPassword({
    email: director.email,
    password,
  })
  failIfError(signInError, `Could not sign in as ${director.email}`)

  const { data: existingTasks, error: tasksError } = await admin
    .from('tasks')
    .select('id, name, description')
    .eq('object_id', object.id)
  failIfError(tasksError, `Could not read tasks for ${object.name}`)

  const existingTasksByName = new Map(existingTasks.map((task) => [task.name, task]))
  for (const { name, description } of seedTasks) {
    const existingTask = existingTasksByName.get(name)
    if (existingTask) {
      if (existingTask.description?.trim()) continue
      const { error } = await admin
        .from('tasks')
        .update({ description })
        .eq('id', existingTask.id)
      failIfError(error, `Could not update description for "${name}" on ${object.name}`)
      continue
    }

    const { error } = await directorClient.rpc('create_task', {
      p_object_id: object.id,
      p_name: name,
      p_description: description,
    })
    failIfError(error, `Could not create task "${name}" for ${object.name}`)
  }
}

console.log('Seed complete: 2 directors, 5 employees, 3 objects, up to 5 described unassigned tasks per object.')
console.log('All seeded accounts use SEED_PASSWORD:')
for (const user of users) console.log(`  ${user.role.padEnd(8)} ${user.email}`)
