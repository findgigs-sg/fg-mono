# FindGigs Monorepo Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the FindGigs monorepo from create-t3-turbo, rename/clean up, swap the DB driver to Supabase, and add tooling (husky, vitest, design tokens).

**Architecture:** TanStack Start serves both the web frontend and API routes (tRPC + Better Auth). Expo mobile app calls the web app's API routes over HTTP. All business logic lives in shared packages.

**Tech Stack:** Turborepo, pnpm, TanStack Start, Expo SDK 55, tRPC v11, Better Auth, Drizzle ORM, Supabase Postgres, shadcn/ui, NativeWind, Vitest, Jest

**Spec:** `docs/superpowers/specs/2026-04-06-monorepo-setup-design.md`
**Linear:** FIN-13

---

## File Map

### Files to delete
- `apps/nextjs/` (entire directory — 21 files)

### Files to rename (directory + all internal package references)
- `apps/tanstack-start/` -> `apps/web/`
- `apps/expo/` -> `apps/mobile/`

### Files to modify (scope rename `@acme` -> `@findgigs`)
Every `package.json`, `tsconfig.json`, `eslint.config.ts`, and source file that imports `@acme/*` across all workspaces.

### Files to modify (DB driver swap)
- `packages/db/src/client.ts` — replace `@vercel/postgres` with `postgres` (node-postgres)
- `packages/db/drizzle.config.ts` — update connection config
- `packages/db/package.json` — swap deps

### Files to create
- `.npmrc` — pnpm hoisting config for Expo
- `design/colors.md`, `design/typography.md`, `design/spacing.md`, `design/radius.md`
- `apps/web/.env.example`, `apps/mobile/.env.example`
- `apps/web/vitest.config.ts`, `packages/api/vitest.config.ts`, `packages/db/vitest.config.ts`

---

## Task 1: Scaffold from create-t3-turbo

**Files:**
- Create: entire monorepo scaffold in temp directory
- Modify: existing fg-mono repo (merge scaffold in)

- [ ] **Step 1: Scaffold the template into a temp directory**

```bash
cd /tmp
npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo findgigs-scaffold
```

When prompted for package manager, select `pnpm`.

- [ ] **Step 2: Copy scaffold into fg-mono (preserve existing files)**

```bash
# From the fg-mono repo root
rsync -av --exclude='.git' --exclude='.github' /tmp/findgigs-scaffold/ /Users/dingruoqian/code/findgigs/fg-mono/
```

This preserves the existing `design/`, `.claude/`, and `.git/` directories.

- [ ] **Step 3: Verify the scaffold copied correctly**

```bash
ls apps/
# Expected: expo  nextjs  tanstack-start

ls packages/
# Expected: api  auth  db  ui  validators

ls tooling/
# Expected: eslint  github  prettier  tailwind  typescript
```

- [ ] **Step 4: Commit the raw scaffold**

```bash
git add -A
git commit -m "chore: scaffold from create-t3-turbo template"
```

---

## Task 2: Delete apps/nextjs

**Files:**
- Delete: `apps/nextjs/` (entire directory)

- [ ] **Step 1: Remove the nextjs app**

```bash
rm -rf apps/nextjs
```

- [ ] **Step 2: Remove nextjs references from root package.json**

In `package.json`, remove the `dev:next` script:

```json
"dev:next": "turbo watch dev -F @acme/nextjs..."
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove apps/nextjs — not needed for FindGigs"
```

---

## Task 3: Rename apps and package scope

**Files:**
- Rename: `apps/tanstack-start/` -> `apps/web/`
- Rename: `apps/expo/` -> `apps/mobile/`
- Modify: every `package.json` across all workspaces (scope rename)
- Modify: every source file importing `@acme/*`

- [ ] **Step 1: Rename the directories**

```bash
mv apps/tanstack-start apps/web
mv apps/expo apps/mobile
```

- [ ] **Step 2: Update apps/web/package.json name**

Change:
```json
"name": "@acme/tanstack-start"
```
To:
```json
"name": "@findgigs/web"
```

- [ ] **Step 3: Update apps/mobile/package.json name**

Change:
```json
"name": "@acme/expo"
```
To:
```json
"name": "@findgigs/mobile"
```

- [ ] **Step 4: Rename @acme -> @findgigs across all files**

Run a global find-and-replace across the entire repo:

```bash
# Replace in all package.json files
find . -name 'package.json' -not -path '*/node_modules/*' -exec sed -i '' 's/@acme\//@findgigs\//g' {} +

# Replace in all TypeScript/JavaScript source files
find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' -o -name '*.mts' | grep -v node_modules | xargs sed -i '' 's/@acme\//@findgigs\//g'

# Replace in all JSON config files (tsconfig, components.json, etc.)
find . -name '*.json' -not -path '*/node_modules/*' -not -name 'pnpm-lock.yaml' -exec sed -i '' 's/@acme\//@findgigs\//g' {} +
```

- [ ] **Step 5: Update pnpm-workspace.yaml**

No changes needed — workspace globs (`apps/*`, `packages/*`, `tooling/*`) are path-based, not name-based.

- [ ] **Step 6: Update root package.json scripts**

Replace any `@acme/` references in scripts:

```json
"auth:generate": "pnpm -F @findgigs/auth generate",
"db:push": "turbo -F @findgigs/db push",
"db:studio": "turbo -F @findgigs/db studio",
```

Remove the `dev:next` script if not already removed.

- [ ] **Step 7: Delete pnpm-lock.yaml and reinstall**

```bash
rm pnpm-lock.yaml
pnpm install
```

- [ ] **Step 8: Verify the build works**

```bash
pnpm turbo run build --filter=@findgigs/web
pnpm turbo run typecheck
```

Expected: both pass without errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: rename apps and scope @acme -> @findgigs"
```

---

## Task 4: Add .npmrc for Expo monorepo compatibility

**Files:**
- Create: `.npmrc`

- [ ] **Step 1: Create .npmrc at repo root**

```
node-linker=hoisted
```

Note: `shamefully-hoist` is not needed when `node-linker=hoisted` is set — they are equivalent.

- [ ] **Step 2: Reinstall to apply the new linker setting**

```bash
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

- [ ] **Step 3: Verify apps still build**

```bash
pnpm turbo run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add .npmrc pnpm-lock.yaml
git commit -m "chore: add .npmrc with node-linker=hoisted for Expo"
```

---

## Task 5: Swap DB driver — @vercel/postgres to Supabase Postgres

**Files:**
- Modify: `packages/db/package.json`
- Modify: `packages/db/src/client.ts`
- Modify: `packages/db/drizzle.config.ts`

- [ ] **Step 1: Update packages/db/package.json — swap driver dependency**

Remove `@vercel/postgres` from dependencies. Add `postgres` (the `postgres.js` driver) and `drizzle-orm/postgres-js`:

```bash
cd packages/db
pnpm remove @vercel/postgres
pnpm add postgres
cd ../..
```

- [ ] **Step 2: Rewrite packages/db/src/client.ts**

Replace the entire file. Old code uses `@vercel/postgres` + `drizzle-orm/vercel-postgres`. New code:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as auth from "./auth-schema";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString);

export const db = drizzle({
  client,
  schema: { ...schema, ...auth },
  casing: "snake_case",
});
```

- [ ] **Step 3: Update packages/db/drizzle.config.ts**

Replace the connection config. The template replaces port 6543 with 5432 for direct connections during migrations. Update to use `DIRECT_URL` env var:

```ts
import type { Config } from "drizzle-kit";

if (!process.env.DIRECT_URL) {
  throw new Error("Missing DIRECT_URL");
}

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
  casing: "snake_case",
} satisfies Config;
```

- [ ] **Step 4: Update .env.example at repo root**

Add the two Supabase URLs:

```
# Supabase Postgres — pgBouncer URL for runtime
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"

# Supabase Postgres — direct URL for migrations
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Better Auth
AUTH_SECRET=""
AUTH_DISCORD_ID=""
AUTH_DISCORD_SECRET=""
AUTH_REDIRECT_PROXY_URL=""
```

- [ ] **Step 5: Verify typecheck passes**

```bash
pnpm turbo run typecheck --filter=@findgigs/db
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: swap DB driver from @vercel/postgres to postgres.js for Supabase"
```

---

## Task 6: Add Drizzle migration workflow

**Files:**
- Modify: `packages/db/package.json` (add scripts)
- Modify: `turbo.json` (add tasks)
- Modify: root `package.json` (add convenience scripts)

- [ ] **Step 1: Add migration scripts to packages/db/package.json**

Add to the `scripts` section:

```json
"generate": "drizzle-kit generate",
"migrate": "drizzle-kit migrate",
"push": "drizzle-kit push",
"studio": "drizzle-kit studio"
```

- [ ] **Step 2: Add turbo tasks for db:generate and db:migrate**

In root `turbo.json`, add to the `tasks` object:

```json
"db:generate": {
  "cache": false
},
"db:migrate": {
  "cache": false
}
```

- [ ] **Step 3: Add convenience scripts to root package.json**

```json
"db:generate": "turbo -F @findgigs/db generate",
"db:migrate": "turbo -F @findgigs/db migrate"
```

- [ ] **Step 4: Add drizzle output directory to .gitignore**

Drizzle migration files should be committed (they're the migration history), but the meta directory can be ignored. Add to `.gitignore`:

```
# Drizzle
packages/db/drizzle/meta/_journal.json
```

Actually — drizzle migration files AND meta should be committed for a proper migration workflow. Do not add anything to `.gitignore` for drizzle.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add drizzle migration workflow (generate + migrate)"
```

---

## Task 7: Add FindGigs user fields to schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add role and onboarding fields to the schema**

The template has a `Post` table in `schema.ts`. Keep it for now (useful for testing tRPC). Add the FindGigs user extension. In `packages/db/src/schema.ts`, add:

```ts
import { pgEnum, pgTable, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user } from "./auth-schema";

export const roleEnum = pgEnum("role", ["worker", "employer"]);

// Extended user profile fields — references Better Auth's user table
// These will be added as columns to the user table via ALTER TABLE,
// or by extending the auth schema generation.
// For now, define a separate profile table that references the auth user.

export const Profile = pgTable("profile", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  role: roleEnum("role"),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const CreateProfileSchema = createInsertSchema(Profile, {
  role: z.enum(["worker", "employer"]),
});

// Keep the existing Post table from the template
export const Post = pgTable("post", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(2048),
});
```

Note: The exact schema may differ from the template's current Post definition. Match the existing pattern and add the Profile table alongside it.

- [ ] **Step 2: Export the new schema from packages/db/src/index.ts**

Verify `packages/db/src/index.ts` re-exports everything from `schema.ts`. It should already do this via `export * from "./schema"`.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm turbo run typecheck --filter=@findgigs/db
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Profile table with role and onboarding fields"
```

---

## Task 8: Upgrade Expo SDK 54 -> 55

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.config.ts`
- Potentially: other Expo config files

- [ ] **Step 1: Run the Expo upgrade tool**

```bash
cd apps/mobile
npx expo install --fix
```

If SDK 55 is available, run:

```bash
npx expo upgrade 55
```

If `expo upgrade` is not available for SDK 55 yet, manually update the `expo` version in `apps/mobile/package.json` and run `npx expo install --fix` to align all Expo packages.

- [ ] **Step 2: Reinstall from root**

```bash
cd ../..
pnpm install
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm turbo run typecheck --filter=@findgigs/mobile
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: upgrade Expo SDK 54 -> 55"
```

---

## Task 9: Add Husky + lint-staged

**Files:**
- Create: `.husky/pre-commit`
- Modify: root `package.json`

- [ ] **Step 1: Install husky and lint-staged**

```bash
pnpm add -Dw husky lint-staged
```

- [ ] **Step 2: Initialize husky**

```bash
npx husky init
```

This creates `.husky/pre-commit` with a default `npm test` command.

- [ ] **Step 3: Update .husky/pre-commit**

Replace the contents of `.husky/pre-commit` with:

```bash
pnpm lint-staged
```

- [ ] **Step 4: Add lint-staged config to root package.json**

Add to root `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

- [ ] **Step 5: Test it works**

```bash
# Stage a file and run lint-staged manually
echo "" >> README.md
git add README.md
npx lint-staged
```

Expected: prettier runs on README.md

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add husky + lint-staged pre-commit hooks"
```

---

## Task 10: Add Vitest to web and packages

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `packages/api/vitest.config.ts`
- Modify: `apps/web/package.json`, `packages/api/package.json`

- [ ] **Step 1: Install vitest at root**

```bash
pnpm add -Dw vitest
```

- [ ] **Step 2: Create apps/web/vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 3: Create packages/api/vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Add test scripts to both package.json files**

In `apps/web/package.json` and `packages/api/package.json`, add:

```json
"test": "vitest run"
```

- [ ] **Step 5: Add a smoke test to packages/api**

Create `packages/api/src/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("smoke test", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 6: Add turbo task for test**

In root `turbo.json`, add to `tasks`:

```json
"test": {
  "dependsOn": ["^build"],
  "cache": false
}
```

- [ ] **Step 7: Add root test script**

In root `package.json`:

```json
"test": "turbo run test"
```

- [ ] **Step 8: Run tests**

```bash
pnpm test
```

Expected: smoke test passes.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: add vitest setup with smoke test"
```

---

## Task 11: Add design token markdown files

**Files:**
- Create: `design/colors.md`
- Create: `design/typography.md`
- Create: `design/spacing.md`
- Create: `design/radius.md`

- [ ] **Step 1: Extract design tokens from the sprint1 design file**

Read `design/sprint1` to extract the color palette, typography, spacing, and radius values. The file contains JSON with the design system. Reference the exported PNGs in `design/exports/` for visual context.

Create `design/colors.md`:

```markdown
# FindGigs Color Tokens

Extracted from Sprint 1 designs.

## Primary
- Blue: `#1A56DB` (primary CTA, buttons)
- Blue Light: `#3B82F6` (gradients, accents)

## Neutral
- Text Primary: `#111827`
- Text Secondary: `#6B7280`
- Background: `#FFFFFF`
- Surface: `#F9FAFB`
- Border: `#E5E7EB`

## Semantic
- Success: TBD (not in Sprint 1 designs)
- Error: TBD
- Warning: TBD
```

Note: Actual values should be extracted from `design/sprint1`. The above are from the research — verify against the actual file.

- [ ] **Step 2: Create design/typography.md**

```markdown
# FindGigs Typography

## Font Family
- Primary: Inter

## Scale
- Heading 1: 24px / Bold
- Heading 2: 20px / Semibold
- Body: 16px / Regular
- Caption: 14px / Regular
- Small: 12px / Regular
```

- [ ] **Step 3: Create design/spacing.md**

```markdown
# FindGigs Spacing

Base unit: 4px

- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
```

- [ ] **Step 4: Create design/radius.md**

```markdown
# FindGigs Border Radius

- sm: 4px
- md: 8px
- lg: 12px
- xl: 16px
- full: 9999px
```

Note: All design token values should be verified against the actual Sprint 1 designs before finalizing.

- [ ] **Step 5: Commit**

```bash
git add design/colors.md design/typography.md design/spacing.md design/radius.md
git commit -m "docs: add design token reference files"
```

---

## Task 12: Add .env.example files

**Files:**
- Modify: `.env.example` (root — already exists from template)
- Create: `apps/web/.env.example`
- Create: `apps/mobile/.env.example`

- [ ] **Step 1: Update root .env.example**

Replace contents with:

```bash
# Supabase Postgres
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Better Auth
AUTH_SECRET=""    # Generate with: openssl rand -base64 32
AUTH_REDIRECT_PROXY_URL=""

# OAuth Providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
APPLE_CLIENT_ID=""
APPLE_CLIENT_SECRET=""
```

- [ ] **Step 2: Create apps/web/.env.example**

```bash
# Inherits from root .env.example via dotenv-cli
# App-specific overrides only

PORT=3001
```

- [ ] **Step 3: Create apps/mobile/.env.example**

```bash
# API URL — points to the web app which serves tRPC + auth routes
EXPO_PUBLIC_API_URL="http://localhost:3001"
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add .env.example files for all apps"
```

---

## Task 13: Configure Vercel project

**Files:**
- No file changes — Vercel configuration via CLI

- [ ] **Step 1: Link the repo to Vercel**

```bash
vercel link --repo
```

Follow prompts to link to the findgigs-sg org and create a project.

- [ ] **Step 2: Set the root directory for the web project**

In the Vercel dashboard or via CLI, set the root directory to `apps/web` for the `findgigs-web` project.

- [ ] **Step 3: Set environment variables in Vercel**

```bash
vercel env add DATABASE_URL
vercel env add DIRECT_URL
vercel env add AUTH_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
```

- [ ] **Step 4: Test a preview deployment**

```bash
vercel deploy
```

Expected: deployment succeeds (may have warnings for missing OAuth config, that's OK).

- [ ] **Step 5: Document the Vercel setup in README**

No commit yet — this will be part of Task 15.

---

## Task 14: Configure GitHub Actions CI

**Files:**
- Modify: `.github/workflows/ci.yml` (already exists from template)

- [ ] **Step 1: Review existing CI workflow**

The template includes `.github/workflows/ci.yml`. Read it and check if it already covers lint, typecheck. It likely uses the `tooling/github/setup/action.yml` reusable action.

- [ ] **Step 2: Add test step to CI**

If not already present, add a test step after the typecheck step:

```yaml
- name: Test
  run: pnpm test
```

- [ ] **Step 3: Update any @acme references in CI config**

Check `.github/workflows/ci.yml` and `tooling/github/setup/action.yml` for `@acme` references and replace with `@findgigs`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: add test step and update scope references"
```

---

## Task 15: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the project README**

Replace the current README with:

```markdown
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

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type check all packages |
| `pnpm test` | Run all tests |
| `pnpm db:push` | Push schema to database |
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with FindGigs setup instructions"
```

---

## Task 16: Final verification

- [ ] **Step 1: Clean install from scratch**

```bash
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

- [ ] **Step 2: Run all checks**

```bash
pnpm turbo run typecheck
pnpm turbo run lint
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Verify dev server starts**

```bash
pnpm dev
```

Expected: TanStack Start dev server starts on port 3001. Expo dev server starts alongside it.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```

- [ ] **Step 5: Push to remote**

```bash
git push origin main
```
