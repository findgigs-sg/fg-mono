# FindGigs Monorepo Setup — Design Spec

**Date:** 2026-04-06
**Linear issue:** FIN-13 — Project Setup & Monorepo Scaffolding
**Status:** Approved
**Author:** Ding Ruoqian (CTO) + Claude

---

## 1. Goal

Scaffold the FindGigs monorepo so the team can start building Sprint 1 features (auth, role selection, onboarding). The repo should build, lint, typecheck, and run dev servers for both web and mobile from day one.

## 2. Bootstrap Approach

Scaffold from `create-t3-turbo` via the Turbo CLI, then modify:

```bash
npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo
```

This template provides ~80% of the target stack out of the box. Modifications are scoped to: DB driver swap, auth provider config, app renaming, and tooling additions.

## 3. Architecture

tRPC and Better Auth run as API routes inside `apps/web` (TanStack Start). No standalone API server for MVP.

```
apps/mobile (Expo) ──HTTP──> apps/web/routes/api/trpc.$.ts  -> packages/api (tRPC routers)
                              apps/web/routes/api/auth.$.ts  -> packages/auth (Better Auth)
                                                              -> packages/db (Drizzle)

apps/web (TanStack Start SSR) ──local link (in-process)──> packages/api (tRPC routers)
```

- Web SSR calls tRPC in-process via `unstable_localLink` (no HTTP hop)
- Web client-side calls `/api/trpc` over HTTP (same origin)
- Mobile calls `apps/web` API routes over HTTP
- Single Vercel project deployment

**Future extraction:** If API traffic competes with SSR, or a second frontend is added, extract `packages/api` + `packages/auth` to a standalone Hono server.

## 4. Tech Stack

| Layer | Choice |
|-------|--------|
| Monorepo | Turborepo + pnpm workspaces |
| API | tRPC v11 (inside TanStack Start API routes) |
| Web | TanStack Start + shadcn/ui |
| Mobile | Expo SDK 55 + NativeWind + React Native Reusables |
| Auth | Better Auth + `@better-auth/expo` |
| Database | Supabase Postgres + Drizzle ORM |
| Storage | Supabase Storage |
| TypeScript | ~5.8.3 |
| Node.js | >=20.0.0 |
| CI/CD | GitHub Actions |
| Hosting | Vercel (single project: `findgigs-web`) |
| Mobile builds | EAS (scaffold only) |

## 5. Monorepo Structure

```
findgigs/
├── design/                  # Existing .pen files, exports, + new design token markdown
│   ├── design.pen
│   ├── sprint1
│   ├── exports/
│   ├── colors.md
│   ├──� typography.md
│   ├── spacing.md
│   └── radius.md
├── apps/
│   ├── web/                 # TanStack Start + shadcn + API routes (tRPC + auth)
│   └── mobile/              # Expo SDK 55 + NativeWind + RN Reusables
├── packages/
│   ├── db/                  # Drizzle schema, client, migrations
│   ├── api/                 # Shared tRPC routers + AppRouter type
│   ├── auth/                # Better Auth factory function
│   ├── ui/                  # shadcn/ui components (web only)
│   └── validators/          # Shared Zod schemas
├── tooling/                 # Kept as-is from create-t3-turbo
│   ├── eslint/
│   ├── github/
│   ├── prettier/
│   ├── tailwind/
│   └── typescript/
├── turbo.json
├── pnpm-workspace.yaml
└── .npmrc
```

## 6. Shared Packages

### `packages/db`

Drizzle ORM with Supabase Postgres. Two connection URLs:

- `DATABASE_URL` — pgBouncer URL for runtime queries
- `DIRECT_URL` — direct connection for migrations

Migration workflow: `drizzle-kit generate` creates SQL migration files, `drizzle-kit migrate` applies them. `db push` only for throwaway dev databases.

Better Auth schema generated via `npx better-auth generate`. User schema extended with FindGigs fields (`role`, `onboardingComplete`, etc.).

### `packages/api`

Shared tRPC routers and `AppRouter` type. Context factory resolves session via Better Auth. Exports `publicProcedure` and `protectedProcedure`.

Consumed by `apps/web` (local link for SSR, HTTP for client) and `apps/mobile` (HTTP only).

### `packages/auth`

Better Auth factory function — each app calls `initAuth()` with runtime env and plugins. Drizzle adapter (from template). Social providers: Google + Apple. Includes `oAuthProxy` and `expo()` plugins for mobile OAuth.

### `packages/ui`

shadcn/ui components for web. Mobile uses React Native Reusables directly in `apps/mobile`.

### `packages/validators`

Shared Zod schemas across web and mobile.

## 7. Auth Architecture

Better Auth runs inside `apps/web` at `/api/auth/*`.

**Web:** `reactStartCookies()` plugin for SSR cookie access. Client uses `createAuthClient()` same-origin.

**Mobile:** `@better-auth/expo` with `expo-secure-store`. `oAuthProxy` for redirect flow. Deep link callbacks via app scheme.

**tRPC context:**

```ts
const createContext = async ({ req }) => {
  const session = await auth.api.getSession({ headers: req.headers })
  return { session, db }
}
```

**Required env vars:**

```
BETTER_AUTH_SECRET
BETTER_AUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APPLE_CLIENT_ID
APPLE_CLIENT_SECRET
DATABASE_URL
DIRECT_URL
```

## 8. Environment Variables

Source of truth: Vercel dashboard (`findgigs-web`), EAS Secrets (mobile).

Local dev: `vercel env pull` or copy from `.env.example`.

Only `.env.example` files are committed. All other `.env*` files are gitignored.

## 9. Linting, Formatting & Pre-commit

Kept from template: ESLint 9 flat config, Prettier, Tailwind config (all in `tooling/`).

Added: Husky + lint-staged for pre-commit hooks on staged `.ts/.tsx/.json/.md` files.

## 10. Testing

Vitest for `apps/web` + `packages/*`. Jest for `apps/mobile`. Unit tests only for MVP — business logic, tRPC procedures, validators.

## 11. Turbo Pipeline

Kept from template with additions:

| Task | Notes |
|------|-------|
| `build` | Depends on `^build` |
| `dev` | No cache, persistent |
| `lint` | Depends on `^topo`, `^build` |
| `typecheck` | Depends on `^topo`, `^build` |
| `test` | New — depends on `^build` |
| `db:push` | From template — interactive |
| `db:generate` | New — Drizzle migration generation |
| `db:migrate` | New — apply migrations |

## 12. Deployment

Single Vercel project (`findgigs-web`) with Git integration. GitHub Actions CI: lint, typecheck, test on PRs. EAS scaffolded only — no build profiles yet.

## 13. Modifications from create-t3-turbo

| Area | Template | FindGigs | Action |
|------|----------|----------|--------|
| DB driver | `@vercel/postgres` | Supabase Postgres | Swap driver |
| Migrations | `drizzle-kit push` | `generate` + `migrate` | Add workflow |
| Auth | Discord | Google + Apple | Reconfigure |
| Expo SDK | 54 | 55 | Upgrade |
| Mobile UI | Raw NativeWind | + RN Reusables | Add components |
| `apps/nextjs` | Included | Not needed | Delete |
| `apps/tanstack-start` | Template name | `apps/web` | Rename |
| `apps/expo` | Template name | `apps/mobile` | Rename |
| `@acme/*` | Template scope | `@findgigs/*` | Rename |
| Pre-commit | None | Husky + lint-staged | Add |
| Testing | None | Vitest + Jest | Add |
| Design tokens | None | `design/*.md` | Add |

## 14. Known Risks

- **Nitro 3.0.1-alpha.1** — TanStack Start server runtime is alpha. Verify Vercel deployment early.
- **Better Auth 1.4.0-beta.9** — beta. Pin version carefully.
- **Expo auth cookie bridge** — `@better-auth/expo` session handling has known issues (t3-turbo #1380).
- **pnpm + Expo** — requires `node-linker=hoisted` in `.npmrc`.

## 15. Open Questions

- Error monitoring: add Sentry before production launch
- E2E testing: Playwright (web) + Maestro (mobile) when UI stabilises
- TanStack Start on Vercel: verify deployment works before committing deeper
- API extraction: standalone Hono server if SSR + API traffic compete

## 16. Setup Checklist

### Phase 1: Scaffold & clean up

1. `npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo` into temp dir
2. Copy into fg-mono (preserve `design/`, `.claude/`, `.git/`)
3. Delete `apps/nextjs`
4. Rename `apps/tanstack-start` -> `apps/web`
5. Rename `apps/expo` -> `apps/mobile`
6. Rename `@acme/*` -> `@findgigs/*`
7. `pnpm install` and verify build

### Phase 2: DB — swap driver & add migrations

1. Replace `@vercel/postgres` with Supabase Postgres driver
2. Configure `DATABASE_URL` (pgBouncer) + `DIRECT_URL` (direct)
3. Set up `drizzle-kit generate` + `drizzle-kit migrate`
4. Add FindGigs user fields (`role`, `onboardingComplete`, etc.)
5. Add turbo tasks `db:generate`, `db:migrate`

### Phase 3: Auth providers

1. Replace Discord with Google + Apple in `packages/auth`
2. Update auth handler in `apps/web` routes
3. Configure `oAuthProxy` for Expo
4. Verify `@better-auth/expo` + `expo-secure-store` in `apps/mobile`

### Phase 4: Mobile upgrades

1. Expo SDK 54 -> 55
2. Add React Native Reusables

### Phase 5: Tooling & DX

1. Husky + lint-staged
2. Vitest for `apps/web`, `packages/*`
3. Jest for `apps/mobile`
4. Design token markdown files in `design/`
5. `.env.example` files

### Phase 6: Deployment & CI

1. Vercel project (`findgigs-web`) with Git integration
2. GitHub Actions CI (lint, typecheck, test)
3. Root `README.md`
