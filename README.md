# CRM

Frontend starter for a serverless CRM built with React, TypeScript, Vite, Mantine, and Supabase.

## Как устроена система

Это система для учёта строительных объектов и работы по ним. На объектах создают задачи, назначают ответственных и отслеживают выполнение. В системе две роли: **постановщик (директор)** и **исполнитель**.

Постановщик видит объекты и задачи все остальных постановщиков. Но может создавать объекты и управлять задачами только на своих объектах: создавать, редактировать, назначать исполнителя и удалять задачи. Редактировать и удалять задачу можно только если ее не взяли в работу. При этом постановщик может проверить задачу **на любом объекте**, даже чужом: принять её или вернуть на доработку, обязательно указав причину. Постановщик также видит историю изменений задач.

Исполнитель видит только назначенные ему задачи и объекты, где есть такие задачи. Он может начать работу, отправить задачу на проверку и, если её вернули, снова взять её в работу. Он не может создавать или редактировать объекты и задачи, назначать исполнителей, удалять задачи, а также принимать или возвращать задачи на доработку.

У каждой задачи есть текущий статус выполнения и история изменения статусов. Система контролирует все изменения статусов: кто может поменять, с какого на какой. Возможные изменения статусов задачи: **новая → в работе → на проверке → принята** или **на доработке → снова в работе** и т.д.
При каждом изменении статуса система записывает, кто и когда его изменил. Записи истории нельзя исправить или удалить обычными действиями в системе, поэтому можно проследить весь ход работы над задачей.

Доступ проверяется не только самим сайтом: правила действуют и на стороне базы данных, где хранятся сведения. Поэтому исполнитель не получит доступ к чужим задачам, даже если попытается обойти ограничения на экране или через браузерные скрипты. Каждый участник может менять только те данные и статусы, которые разрешены его роли.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The legacy `VITE_SUPABASE_ANON_KEY` is also supported. The browser app uses only a public key; never put a Supabase secret or service-role key in frontend environment variables.

## Supabase database and demo data

Apply the SQL files in `supabase/migrations/` to your Supabase project

To create demo accounts and data, create `.env.seed.local` in the project root:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SEED_PASSWORD=choose-a-strong-password-at-least-12-characters
SEED_CONFIRM_REMOTE=yes
```

Get the URL and keys from **Project Settings → API** in the Supabase Dashboard. The seed script uses the service-role key only from this local, git-ignored file; never add it to `.env.local`, any `VITE_` variable, or source control. The script creates or updates the reserved `@crm.test` accounts and sets their password to `SEED_PASSWORD`. `SEED_CONFIRM_REMOTE=yes` is required because the configured Supabase project is remote.

Run:

```bash
npm run seed
```

The script creates two directors (`director1@crm.test`, `director2@crm.test`), five employees (`employee1@crm.test` through `employee5@crm.test`), three objects (two owned by the first director, one by the second), and five unassigned `new` tasks with descriptions per object. Demo profiles use the names “Директор 1/2” and “Исполнитель 1–5”. It is safe to rerun: existing users/profiles/objects are updated and existing seed tasks are not duplicated. Empty descriptions on matching seed tasks are filled; non-empty descriptions are preserved.

For the frontend, put the same project URL and publishable key in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then start it:

```bash
npm run dev
```

Open the printed local URL (usually `http://localhost:5173/login`) and sign in with any listed email and the `SEED_PASSWORD` value. To compare users, use separate browser profiles or private windows; otherwise sign out before switching accounts.

## Screens

- Email/password sign-in with Supabase Auth
- Object list and object card
- Task card with status history
- My tasks
