# CRM

Frontend starter for a serverless CRM built with React, TypeScript, Vite, Mantine, and Supabase.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The legacy `VITE_SUPABASE_ANON_KEY` is also supported. The browser app uses only a public key; never put a Supabase secret or service-role key in frontend environment variables.

## Supabase database and demo data

Apply the SQL files in `supabase/migrations/` to your Supabase project in timestamp order:

Apply `20261105160400_profiles_name_nullable.sql` first, then backfill names as described below. Only after every existing profile has a non-empty name, apply `20261105160500_profiles_name_not_null.sql` and the following migration.

1. `20261105160000_schema.sql`
2. `20261105160100_logic.sql`
3. `20261105160200_rls.sql`
4. `20261105160300_service_role_grants.sql`
5. `20261105160400_profiles_name_nullable.sql`
6. `20261105160500_profiles_name_not_null.sql` (after backfilling every existing profile)
7. `20261105175400_profiles_history_author_names.sql`

In the Supabase Dashboard, open **SQL Editor**, create a query for each file, paste its full contents, and run them in order. Wait for each query to succeed before running the next. Do not run these files against a project that already has the same schema.

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

To fill descriptions for seed tasks that already exist, run:

```bash
npm run tasks:backfill-descriptions
```

The script uses the service-role key from `.env.seed.local`, requires `SEED_CONFIRM_REMOTE=yes` for remote projects, and only updates seed tasks with an empty description.

The profile-name migration initially allows existing profiles to remain without a name. Populate names before applying `20261105160500_profiles_name_not_null.sql`. To set names for existing users, add this value to `.env.seed.local` (JSON keys are Auth email addresses):

```dotenv
PROFILE_NAMES_JSON={"employee@example.com":"Name Surname","director@example.com":"Name Surname"}
```

Then run `npm run profiles:backfill-names`. The script uses the service-role key from `.env.seed.local`; remote projects require `SEED_CONFIRM_REMOTE=yes`. After every existing profile has a non-empty name, run `20261105160500_profiles_name_not_null.sql` in the SQL Editor.

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
