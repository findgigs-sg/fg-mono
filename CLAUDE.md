# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FindGigs - a gig marketplace connecting workers with employers. Turborepo monorepo based on create-t3-turbo.

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
- `packages/auth` — Better Auth config (Discord OAuth, Drizzle adapter)
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

**Imports:** Use `@findgigs/*` workspace aliases (e.g., `@findgigs/api`, `@findgigs/db/client`, `@findgigs/ui/button`). Within apps, use `~/` path alias for `./src/`.

## Code Conventions

- Package manager: pnpm (v10.19.0). Never use npm or yarn.
- Node: v22.21.0+
- TypeScript strict mode. Prefer type imports (`import type`).
- Unused variables must be prefixed with `_`.
- Git hooks: Husky + lint-staged runs Prettier on commit.
- UI components export individually for tree-shaking (e.g., `@findgigs/ui/button` not `@findgigs/ui`).

<!-- VERCEL BEST PRACTICES START -->

## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
