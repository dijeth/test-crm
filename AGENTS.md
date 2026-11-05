# Project instructions

## Project

This is a serverless CRM frontend built with React, TypeScript, Vite, Mantine, and Supabase. Keep the implementation straightforward and avoid adding backend services or dependencies unless the requirements need them.

The application has two roles: task creator and assignee. Core entities are construction objects (name and address) and their tasks. The creator manages objects and tasks, assigns assignees, reviews submissions, and can see all records. Assignees see only their own tasks and objects that contain their tasks, start work, and submit tasks for review. Keep permissions and valid status transitions consistent with this workflow.

## Development

- Install dependencies with `npm install`.
- Start the development server with `npm run dev`.
- Verify changes with `npm run build` and `npm run lint`.
- Use Mantine for UI components and React Router for routes.
- Use `@supabase/supabase-js` for Supabase access and TanStack Query for server-state when appropriate.
- Keep screens usable on narrow viewports and follow existing project patterns.

## Supabase and security

- Frontend configuration uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The legacy `VITE_SUPABASE_ANON_KEY` is also supported.
- Never expose a Supabase Secret key or legacy `service_role` key in browser code or `VITE_` environment variables.
- Enforce data access with Supabase Row Level Security (RLS); client-side role checks are not an authorization boundary.
- Ensure database policies enforce creator/assignee visibility and allowed changes. Do not rely on hiding UI controls to protect data or workflow transitions.
- Keep secrets out of source control. Use `.env.local` for local configuration; `.env.example` must contain placeholders only.
- Record task status changes and other required audit events in the database, not only in client state.

## Scope and data model

- The Supabase schema and exact task fields/status names are defined by the project requirements and migrations; do not invent or silently change them.
- When a request leaves a business rule ambiguous (for example, who may delete a task or which statuses can transition), ask before encoding the rule in UI or database policies.
- Keep object and task history attributable and append-only where possible; avoid silently overwriting audit history.
