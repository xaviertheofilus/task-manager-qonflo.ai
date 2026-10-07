# Mini Task Manager

A small internal task manager built for the [take-home requirements](TASK_SPEC.md). Create tasks, move them through `to_do → pending → in_progress → done`, and view an immutable status history for each task. The UI also offers a board, search and status filters, due dates, insights, a theme switch, and responsive navigation.

## Stack and structure

- `src/`: React, TypeScript, Vite, React Router, Inter, and Lucide icons from `react-icons`.
- `server/`: Express API and server-side Supabase client.
- `supabase/schema.sql`: PostgreSQL tables, status transition function, and audit protection.
- `api/index.ts` and `vercel.json`: Vercel function and SPA routes.

The browser calls only the Express API. The Supabase secret key stays on the server. No Docker or separate local database is needed.

## Run locally

Requires Node.js 24 and a Supabase project.

```bash
npm ci
cp .env.example .env
```

Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `.env`. `SUPABASE_SERVICE_ROLE_KEY` is accepted as an alternative secret key name. Never use a `VITE_` prefix for a secret. Apply [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL Editor. If `DATABASE_URL` is available, `npm run db:setup` applies the same schema instead.

Run these commands in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

Open `http://localhost:5173`. The API runs on port `3001`, and Vite proxies `/api` to it. In PowerShell, use `Copy-Item .env.example .env` and `npm.cmd`/`npx.cmd` in place of `cp`/`npm`/`npx`.

## Verify

```bash
npm run build
npm test
npx playwright install chromium # first run only
npm run test:e2e
```

API tests cover validation, sequential and concurrent transitions, idempotency, audit immutability, soft deletion, persistence, and the Vercel API rewrite. The browser test covers the main task journey, filters, board, timeline, insights, theme, user menu, and responsive sidebar. Tests use the configured Supabase project and leave soft-deleted test tasks so their audit records remain intact.

## Deploy to Vercel

Import this repository with the root directory as the project root. The checked-in `vercel.json` builds the Vite app, serves SPA routes, and sends `/api/*` to the Express function. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) as Vercel server environment variables, then apply the schema to the target Supabase project. `DATABASE_URL` is needed only for `db:setup`, not for runtime. A live Vercel deployment still requires a connected Vercel project and credentials.

## Decisions and limits

- A task has an ID, title, status, priority, optional due date, creation time, and optional deletion time. Priority and due date extend the minimum task requirements; they do not create audit entries.
- Deletion is soft deletion. Deleted tasks leave active lists but remain readable on the deleted tasks page (`/trash`), along with their audit history. Creation and deletion do not create status audit entries.
- Status changes run in one PostgreSQL transaction with a row lock: validate the next step, update the task, and insert one log. Repeating the current status does nothing. Logs are read in chronological order. There is no log edit/delete API, and a database trigger rejects updates and deletes to audit rows. A database administrator can still alter the schema.
- Actors come from a fixed dropdown, as allowed by the task. There is no login. At higher user counts, unverified actor identity is the largest risk. The first larger-system refactor should add authenticated identities and access rules; query pagination and module splitting can follow when usage warrants them.
- With more time, add authentication and task pagination. The current client-side filters suit this small internal project; Supabase's default response limit will need pagination as the task count grows.
- AI assisted the initial documents, implementation, and tests. The solution is checked with the build, API tests, and browser test; any Vercel deployment must also be smoke-tested after connection to an account.

The visual style was informed by the separate Open Silong reference. The app has no runtime dependency on that folder. See [PRD.md](PRD.md) and [ERD.md](ERD.md) for product scope and data relationships.
