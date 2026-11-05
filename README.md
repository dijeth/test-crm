# CRM

Frontend starter for a serverless CRM built with React, TypeScript, Vite, Mantine, and Supabase.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The legacy `VITE_SUPABASE_ANON_KEY` is also supported. The browser app uses only a public key; never put a Supabase secret or service-role key in frontend environment variables.

## Screens

- Email/password sign-in with Supabase Auth
- Object list and object card
- Task card with action/history placeholder
- My tasks

The CRM screens are route and UI scaffolds. Database queries depend on the final Supabase schema and row-level security policies.
