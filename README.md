# FindGigs Monorepo

Gig marketplace connecting workers with employers. Built with Turborepo.

## Tech Stack

- **Web:** TanStack Start + shadcn/ui
- **Mobile:** Expo SDK 55 + NativeWind + React Native Reusables
- **API:** tRPC v11 (inside TanStack Start API routes)
- **Auth:** Better Auth (email/password, Google + Apple OAuth)
- **Database:** Supabase Postgres + Drizzle ORM
- **CI/CD:** GitHub Actions (PR gate + deploy workflow)
- **Deployment:** Vercel (web), EAS (mobile)

## Prerequisites

- Node.js >= 22.21.0 (see `.nvmrc`)
- pnpm >= 10.19.0 (enforced via `packageManager` field)
- Docker/OrbStack (for local Postgres)
- [direnv](https://direnv.net/) (for loading tooling tokens)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/findgigs-sg/fg-mono.git
cd fg-mono
pnpm install
```

### 2. Application env vars

Copy and fill in environment variables used by the app at runtime:

```bash
cp .env.example .env
```

At minimum you need:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/findgigs"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/findgigs"
AUTH_SECRET="<run: openssl rand -base64 32>"
```

See `.env.example` for the full list (OAuth credentials, etc.).

### 3. Mobile env vars

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Set `EXPO_PUBLIC_API_URL` to your web app URL (defaults to `http://localhost:3001`).

### 4. Tooling tokens (direnv)

These are personal access tokens for CLI tools and MCP servers. They are **not** used by the app at runtime.

First, [install direnv](https://direnv.net/docs/installation.html) and add the shell hook:

```bash
# zsh (~/.zshrc)
eval "$(direnv hook zsh)"

# bash (~/.bashrc)
eval "$(direnv hook bash)"
```

Then set up your tokens:

```bash
cp .envrc.example .envrc
# Fill in your personal tokens (VERCEL_TOKEN, LINEAR_API_KEY, SUPABASE_TOKEN)
direnv allow
```

See `.envrc.example` for token descriptions and where to generate them.

### 5. Database

Start a local Postgres instance and create the database:

```bash
docker run -d --name findgigs-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:latest
docker exec findgigs-db psql -U postgres -c "CREATE DATABASE findgigs;"
```

Apply migrations to set up the schema:

```bash
pnpm db:migrate
```

### 6. Start development

```bash
pnpm dev
```

This starts the web app (port 3001) and the Expo dev server concurrently.

## Database Migrations

Schema is defined in `packages/db/src/schema.ts`. Auth schema is auto-generated in `packages/db/src/auth-schema.ts` — don't edit it manually.

### Making schema changes

1. Edit `packages/db/src/schema.ts`
2. Generate a migration file:
   ```bash
   pnpm db:generate
   ```
3. Review the generated SQL in `packages/db/drizzle/`
4. Apply locally:
   ```bash
   pnpm db:migrate
   ```
5. Commit the migration files with your PR

Migrations run automatically on merge to main via the deploy workflow.

### Other database commands

```bash
pnpm db:push       # Push schema directly (dev only, skips migration files)
pnpm db:studio     # Open Drizzle Studio (database browser)
pnpm auth:generate # Regenerate Better Auth schema after auth config changes
```

## Project Structure

```
apps/
  web/          TanStack Start web app + API routes → Vercel
  mobile/       Expo mobile app → EAS

packages/
  api/          Shared tRPC routers
  auth/         Better Auth configuration
  db/           Drizzle schema + migrations
  ui/           shadcn/ui components (web) + React Native Reusables (mobile)
  validators/   Shared Zod schemas

tooling/
  eslint/       Shared ESLint configs
  github/       GitHub Actions reusable setup
  prettier/     Shared Prettier config
  tailwind/     Shared Tailwind theme
  typescript/   Shared tsconfigs
```

## Commands

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `pnpm dev`         | Start all dev servers               |
| `pnpm build`       | Build all packages                  |
| `pnpm lint`        | Lint all packages                   |
| `pnpm lint:fix`    | Lint and auto-fix                   |
| `pnpm format`      | Check formatting                    |
| `pnpm format:fix`  | Format with Prettier                |
| `pnpm typecheck`   | Type check all packages             |
| `pnpm test`        | Run all tests (Vitest)              |
| `pnpm db:generate` | Generate migration files            |
| `pnpm db:migrate`  | Apply migrations                    |
| `pnpm db:push`     | Push schema directly (dev only)     |
| `pnpm db:studio`   | Open Drizzle Studio                 |
| `pnpm dev:tunnel`  | Start dev server + Tailscale tunnel |

Run a single package with the filter flag:

```bash
pnpm -F @findgigs/web dev   # Web only
pnpm -F @findgigs/db push   # DB push only
```

## Environment Variables

All app env vars are validated with `@t3-oss/env-core`. Raw `process.env` access is restricted by ESLint — use the validated env files (`apps/web/src/env.ts`, `packages/auth/env.ts`).

**Application** (`.env`):

| Variable                  | Package          | Description                       |
| ------------------------- | ---------------- | --------------------------------- |
| `DATABASE_URL`            | `@findgigs/db`   | Postgres pooler connection string |
| `DIRECT_URL`              | `@findgigs/db`   | Postgres direct connection string |
| `AUTH_SECRET`             | `@findgigs/auth` | Better Auth secret key            |
| `AUTH_REDIRECT_PROXY_URL` | `@findgigs/auth` | Auth redirect proxy URL           |
| `GOOGLE_CLIENT_ID`        | `@findgigs/auth` | Google OAuth client ID            |
| `GOOGLE_CLIENT_SECRET`    | `@findgigs/auth` | Google OAuth client secret        |
| `APPLE_CLIENT_ID`         | `@findgigs/auth` | Apple Sign-In Services ID         |
| `APPLE_CLIENT_SECRET`     | `@findgigs/auth` | Apple Sign-In JWT secret          |
| `APPLE_APP_BUNDLE_ID`     | `@findgigs/auth` | iOS bundle ID for native sign-in  |

**Tooling** (`.envrc` via direnv):

| Variable         | Description                        |
| ---------------- | ---------------------------------- |
| `VERCEL_TOKEN`   | Vercel CLI — deploys, env sync     |
| `LINEAR_API_KEY` | Linear MCP server — issue tracking |
| `SUPABASE_TOKEN` | Supabase MCP server — DB admin     |

## CI/CD

- **PR Gate** (`pr-gate.yml`): Runs lint, format, typecheck, build, test on every PR. All must pass to merge.
- **Deploy** (`deploy.yml`): On merge to main, path-filtered jobs run DB migrations and deploy to Vercel.
- **Branch protection**: Strict mode on `main` — requires all PR gate checks to pass.
- **Vercel CLI** uses token-based auth via `VERCEL_TOKEN` — do not use `vercel login`.
