# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project Overview

FindGigs — a gig marketplace connecting workers with employers. Turborepo monorepo based on create-t3-turbo.

## Common Commands

```bash
pnpm dev                    # Start all dev servers (web + mobile + packages)
pnpm build                  # Build all packages
pnpm lint                   # Lint all packages (cached)
pnpm lint:fix               # Lint and auto-fix
pnpm format:fix             # Format with Prettier
pnpm typecheck              # Type check all packages
pnpm test                   # Run tests (Vitest)

# Database (Drizzle ORM + Supabase Postgres)
pnpm db:push                # Push schema to database
pnpm db:generate            # Generate migrations
pnpm db:migrate             # Apply migrations
pnpm db:studio              # Open Drizzle Studio
pnpm auth:generate          # Regenerate Better Auth schema

# Run a single package
pnpm -F @findgigs/web dev   # Web only
pnpm -F @findgigs/db push   # DB push only
```

## Architecture

**Monorepo layout:**

- `apps/web` — TanStack Start (Vite + React 19 + Nitro) with file-based routing
- `apps/mobile` — Expo SDK 55 (React Native) with Expo Router
- `packages/api` — tRPC v11 routers (shared between web and mobile)
- `packages/auth` — Better Auth config (email/password, Drizzle adapter)
- `packages/db` — Drizzle ORM schema + client (Supabase Postgres)
- `packages/ui` — Shared UI components (shadcn/ui for web, React Native Reusables for mobile)
- `packages/validators` — Shared Zod schemas
- `tooling/*` — Shared configs (eslint, prettier, typescript, tailwind)

**Key stack:** tRPC v11, Better Auth (beta), Drizzle ORM, Zod v4, TanStack React Query, TanStack React Form, Tailwind CSS v4, SuperJSON.

## Key Patterns

**tRPC:** Public and protected procedures defined in `packages/api/src/trpc.ts`. Protected procedures enforce authenticated sessions. Router composed in `packages/api/src/root.ts`. Web app uses `unstable_localLink` for SSR calls, `httpBatchStreamLink` for client calls.

**Auth:** Better Auth initialized per-app (`apps/web/src/auth/server.ts`) using shared `initAuth()` from `packages/auth`. Auth schema auto-generated into `packages/db/src/auth-schema.ts` — don't edit manually, run `pnpm auth:generate`.

**Database:** Drizzle uses `snake_case` casing mode. Custom tables in `packages/db/src/schema.ts`. Zod schemas derived from Drizzle tables via `drizzle-zod`.

**Environment:** All env vars validated with `@t3-oss/env-core`. Raw `process.env` access is restricted by ESLint — use validated env files (`apps/web/src/env.ts`, `packages/auth/env.ts`).

**Vercel CLI:** Token-based auth via `VERCEL_TOKEN` in root `.env` — do not use `vercel login`.

**Imports:** Use `@findgigs/*` workspace aliases (e.g., `@findgigs/api`, `@findgigs/db/client`, `@findgigs/ui/button`). Within apps, use `~/` path alias for `./src/`.

## Code Conventions

- Package manager: pnpm (v10.19.0). Never use npm or yarn.
- Node: v22.21.0+
- TypeScript strict mode. Prefer type imports (`import type`).
- Unused variables must be prefixed with `_`.
- Git hooks: Husky + lint-staged runs Prettier on commit.
- UI components export individually for tree-shaking (e.g., `@findgigs/ui/button` not `@findgigs/ui`).

## CI/CD

- **PR Gate** (`pr-gate.yml`): lint, format, typecheck, build, test — all required to merge.
- **Deploy** (`deploy.yml`): On push to main, path-filtered DB migrations + Vercel deploy.
- **Vercel config** in `apps/web/vercel.ts`: framework `nitro`, region `sin1`, env validation in buildCommand.
- **Branch protection**: Strict mode on `main`.

## Deployment

- **Production:** https://fg-mono-web.vercel.app
- **Framework:** Nitro (TanStack Start uses Nitro under the hood)
- **Region:** sin1 (Singapore)
- **Auto-deploy on main:** Disabled — deploy workflow handles it via `vercel deploy --prod`
