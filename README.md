# FindGigs Monorepo

Gig marketplace connecting workers with employers. Built with Turborepo.

## Tech Stack

- **Web:** TanStack Start + shadcn/ui
- **Mobile:** Expo SDK 55 + NativeWind + React Native Reusables
- **API:** tRPC v11 (inside TanStack Start API routes)
- **Auth:** Better Auth (Google + Apple OAuth)
- **Database:** Supabase Postgres + Drizzle ORM
- **Deployment:** Vercel (web), EAS (mobile)

## Getting Started

### Prerequisites

- Node.js >= 20.0.0 (recommended: use `.nvmrc`)
- pnpm >= 10.19.0

### Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/findgigs-sg/fg-mono.git
   cd fg-mono
   pnpm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in the Supabase and OAuth credentials. See `.env.example` for descriptions.

3. Push the database schema:

   ```bash
   pnpm db:push
   ```

4. Start development:

   ```bash
   pnpm dev
   ```

   This starts the web app (port 3001) and the Expo dev server concurrently.

### Database Migrations

```bash
# Generate a migration after schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema directly (dev only)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

## Project Structure

```
apps/
  web/       TanStack Start web app + API routes
  mobile/    Expo mobile app

packages/
  api/       Shared tRPC routers
  auth/      Better Auth configuration
  db/        Drizzle schema + migrations
  ui/        shadcn/ui components (web)
  validators/ Shared Zod schemas

tooling/
  eslint/    Shared ESLint configs
  prettier/  Shared Prettier config
  tailwind/  Shared Tailwind theme
  typescript/ Shared tsconfigs
```

## Scripts

| Command            | Description              |
| ------------------ | ------------------------ |
| `pnpm dev`         | Start all dev servers    |
| `pnpm build`       | Build all packages       |
| `pnpm lint`        | Lint all packages        |
| `pnpm typecheck`   | Type check all packages  |
| `pnpm test`        | Run all tests            |
| `pnpm db:push`     | Push schema to database  |
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate`  | Apply migrations         |
| `pnpm db:studio`   | Open Drizzle Studio      |
