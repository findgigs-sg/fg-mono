# FindGigs Monorepo

Gig marketplace connecting workers with employers. Built with Turborepo.

## Tech Stack

- **Web:** TanStack Start + shadcn/ui
- **Mobile:** Expo SDK 55 + NativeWind + React Native Reusables
- **API:** tRPC v11 (inside TanStack Start API routes)
- **Auth:** Better Auth (email/password, Google + Apple OAuth planned)
- **Database:** Supabase Postgres + Drizzle ORM
- **CI/CD:** GitHub Actions (PR gate + deploy workflow)
- **Deployment:** Vercel (web), EAS (mobile)

## Getting Started

### Prerequisites

- Node.js >= 22.21.0 (see `.nvmrc`)
- pnpm >= 10.19.0
- Docker/OrbStack (for local Postgres)

### Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/findgigs-sg/fg-mono.git
   cd fg-mono
   pnpm install
   ```

2. Start a local Postgres instance and create the database:

   ```bash
   docker run -d --name findgigs-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:latest
   docker exec findgigs-db psql -U postgres -c "CREATE DATABASE findgigs;"
   ```

3. Copy and fill in environment variables:

   ```bash
   cp .env.example .env
   ```

   At minimum you need:

   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/findgigs"
   DIRECT_URL="postgresql://postgres:postgres@localhost:5432/findgigs"
   AUTH_SECRET="<run: openssl rand -base64 32>"
   ```

4. Apply database migrations:

   ```bash
   pnpm db:migrate
   ```

5. Start development:

   ```bash
   pnpm dev
   ```

   This starts the web app (port 3001) and the Expo dev server concurrently.

### Database Migrations

```bash
pnpm db:generate    # Generate a migration after schema changes
pnpm db:migrate     # Apply migrations
pnpm db:push        # Push schema directly (dev only, skips migration files)
pnpm db:studio      # Open Drizzle Studio
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
  ui/           shadcn/ui components (web)
  validators/   Shared Zod schemas

tooling/
  eslint/       Shared ESLint configs
  github/       GitHub Actions reusable setup
  prettier/     Shared Prettier config
  tailwind/     Shared Tailwind theme
  typescript/   Shared tsconfigs
```

## Scripts

| Command            | Description              |
| ------------------ | ------------------------ |
| `pnpm dev`         | Start all dev servers    |
| `pnpm build`       | Build all packages       |
| `pnpm lint`        | Lint all packages        |
| `pnpm format`      | Check formatting         |
| `pnpm typecheck`   | Type check all packages  |
| `pnpm test`        | Run all tests            |
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate`  | Apply migrations         |
| `pnpm db:push`     | Push schema (dev only)   |
| `pnpm db:studio`   | Open Drizzle Studio      |

## CI/CD

- **PR Gate** (`pr-gate.yml`): Runs lint, format, typecheck, build, test on every PR. All must pass to merge.
- **Deploy** (`deploy.yml`): On merge to main, path-filtered jobs run DB migrations and deploy to Vercel.
- **Branch protection**: Strict mode on `main` — requires all PR gate checks to pass.
