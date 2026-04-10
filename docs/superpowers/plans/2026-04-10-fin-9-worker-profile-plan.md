# FIN-9 Worker Profile Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the worker profile creation screen (FIN-9) — a single scrollable form for name/phone/bio/job-categories/photo, with Supabase Storage avatar upload, that flips `profile.onboarding_complete = true` and lands the worker on the home placeholder.

**Architecture:** Backend adds a `JobCategory` seed script, a new `storage` tRPC router with `getAvatarUploadUrl` (presigned URL via Supabase service-role key), and extends `profile` router tests. Mobile extends the existing AuthGuard with a new rule, rewrites the placeholder `worker-profile.tsx` as a TanStack React Form with `CategoryChips` and a `PhotoPicker` component that uses `expo-image-picker` + `expo-image-manipulator` to compress and PUT photos to the signed upload URL.

**Tech Stack:** Drizzle ORM, tRPC v11, @supabase/supabase-js (server-only), vitest, TanStack React Form, expo-image-picker, expo-image-manipulator, Expo Router, NativeWind, Better Auth.

**Spec:** `docs/superpowers/specs/2026-04-10-fin-9-worker-profile-design.md`

**Branch:** `bubuding0809/fin-9-worker-profile-creation` (matches Linear `gitBranchName` — required for auto-close on merge)

---

## File Structure

| File                                                | Action      | Responsibility                                                                                      |
| --------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `packages/api/env.ts`                               | **Create**  | Zod-validated server env for the api package (Supabase vars live here)                              |
| `packages/api/src/router/storage.ts`                | **Create**  | `storage.getAvatarUploadUrl` tRPC mutation — returns a signed upload URL from Supabase Storage      |
| `packages/api/src/router/__tests__/storage.test.ts` | **Create**  | vitest suite for the storage router with mocked `@supabase/supabase-js`                             |
| `packages/api/src/root.ts`                          | **Modify**  | Register `storageRouter` in the app router                                                          |
| `packages/api/src/router/__tests__/profile.test.ts` | **Modify**  | Extend with `describe("completeWorkerProfile")` block (8 tests)                                     |
| `packages/api/package.json`                         | **Modify**  | Add `@supabase/supabase-js` dependency                                                              |
| `packages/db/src/seed.ts`                           | **Create**  | Idempotent seed script for `job_category` table, reads from `JOB_CATEGORIES` constant in validators |
| `packages/db/package.json`                          | **Modify**  | Add `seed` script + `@findgigs/validators` dependency                                               |
| `package.json` (root)                               | **Modify**  | Add `db:seed` script                                                                                |
| `.env.example`                                      | **Modify**  | Add dummy-but-schema-valid Supabase env vars                                                        |
| `.github/workflows/pr-gate.yml`                     | **Modify**  | Add `Seed DB` step to the `test` job                                                                |
| `apps/mobile/package.json`                          | **Modify**  | Add `expo-image-picker` + `expo-image-manipulator` dependencies                                     |
| `apps/mobile/app.config.ts`                         | **Modify**  | Add `expo-image-picker` plugin config with iOS permission strings                                   |
| `apps/mobile/src/app/_layout.tsx`                   | **Modify**  | Extend `AuthGuard` with rule 4 (worker + !onboardingComplete → /worker-profile)                     |
| `apps/mobile/src/app/worker-profile.tsx`            | **Rewrite** | Full rewrite from placeholder — TanStack React Form + PhotoPicker + CategoryChips                   |
| `README.md`                                         | **Modify**  | Add "One-time Supabase Storage setup" subsection                                                    |

---

## Task 1: Add Supabase env vars to api package

**Files:**

- Create: `packages/api/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create `packages/api/env.ts`**

Create file with the following content:

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    // Supabase Storage — required in production, optional elsewhere so
    // local dev without Supabase configured doesn't crash on import.
    SUPABASE_URL:
      process.env.NODE_ENV === "production" ? z.url() : z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    SUPABASE_AVATAR_BUCKET: z.string().default("avatars"),
  },
  runtimeEnv: process.env,
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.npm_lifecycle_event === "lint",
});
```

- [ ] **Step 2: Add `@t3-oss/env-core` dependency to `packages/api/package.json`**

Check if it's already listed. If not, add via:

```bash
pnpm -F @findgigs/api add @t3-oss/env-core
```

Expected: `@t3-oss/env-core` appears under `dependencies` in `packages/api/package.json`.

- [ ] **Step 3: Add dummy Supabase values to `.env.example`**

Append to the end of `.env.example`:

```dotenv

# ──────────────────────────────────────────────
# @findgigs/api — Supabase Storage
# Bucket: "avatars" (public), created manually in the Supabase dashboard.
# Values below are placeholders that pass schema validation in CI and
# local `pnpm test`. Replace with real values for smoke testing the
# photo upload flow locally.
# ──────────────────────────────────────────────
SUPABASE_URL="https://placeholder.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="placeholder-service-role-key-do-not-use-in-prod"
SUPABASE_AVATAR_BUCKET="avatars"
```

- [ ] **Step 4: Run typecheck to verify nothing broke**

Run:

```bash
pnpm -F @findgigs/api typecheck
```

Expected: exit code 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/api/env.ts packages/api/package.json pnpm-lock.yaml .env.example
git commit -m "feat(api): add Supabase env vars for storage router"
```

---

## Task 2: Create JobCategory seed script + CI wiring

**Files:**

- Create: `packages/db/src/seed.ts`
- Modify: `packages/db/package.json`, root `package.json`, `.github/workflows/pr-gate.yml`

- [ ] **Step 1: Add `@findgigs/validators` dependency to `packages/db/package.json`**

The seed script reads from the `JOB_CATEGORIES` constant in `@findgigs/validators`. Add the workspace dependency:

```bash
pnpm -F @findgigs/db add @findgigs/validators@workspace:*
```

Expected: `packages/db/package.json` has `"@findgigs/validators": "workspace:*"` under `dependencies`.

- [ ] **Step 2: Create `packages/db/src/seed.ts`**

```ts
import { sql } from "drizzle-orm";

import { JOB_CATEGORIES } from "@findgigs/validators";

import { db } from "./client";
import { JobCategory } from "./schema";

async function main() {
  const rows = JOB_CATEGORIES.map((c, index) => ({
    slug: c.slug,
    label: c.label,
    sortOrder: index,
  }));

  await db
    .insert(JobCategory)
    .values(rows)
    .onConflictDoUpdate({
      target: JobCategory.slug,
      set: {
        label: sql`excluded.label`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  console.log(`Seeded ${rows.length} job categories.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 3: Add `seed` script to `packages/db/package.json`**

In `packages/db/package.json`, add under `scripts`:

```json
"seed": "pnpm with-env tsx src/seed.ts"
```

The existing `with-env` script (`"dotenv -e ../../.env --"`) loads the root `.env` file.

- [ ] **Step 4: Add `db:seed` script to root `package.json`**

In the root `package.json`, add under `scripts` (alongside the other `db:*` scripts):

```json
"db:seed": "turbo -F @findgigs/db seed"
```

- [ ] **Step 5: Run the seed locally and verify**

Make sure Docker Postgres is up and the schema is pushed:

```bash
pnpm db:push
pnpm db:seed
```

Expected output includes:

```
Seeded 8 job categories.
```

Verify via drizzle-studio or psql:

```bash
pnpm -F @findgigs/db studio
```

Open the `job_category` table and confirm 8 rows exist with slugs `food-and-beverage`, `events`, `retail`, `cleaning`, `warehouse-and-logistics`, `admin-and-reception`, `promotions-and-marketing`, `general-labor`.

- [ ] **Step 6: Re-run seed to verify idempotency**

```bash
pnpm db:seed
```

Expected: still prints `Seeded 8 job categories.`, still only 8 rows in the table (no duplicates), no errors.

- [ ] **Step 7: Add `Seed DB` step to `.github/workflows/pr-gate.yml`**

In the `test` job, add a new step after `Push DB schema` and before `Test`:

```yaml
- name: Seed DB
  run: pnpm db:seed
```

Full updated `test` job steps (for reference):

```yaml
steps:
  - uses: actions/checkout@v5

  - name: Setup
    uses: ./tooling/github/setup

  - name: Copy env
    shell: bash
    run: cp .env.example .env

  - name: Push DB schema
    run: pnpm -F @findgigs/db push

  - name: Seed DB
    run: pnpm db:seed

  - name: Test
    run: pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/seed.ts packages/db/package.json package.json .github/workflows/pr-gate.yml pnpm-lock.yaml
git commit -m "feat(db): add JobCategory seed script and CI wiring"
```

---

## Task 3: Write vitest suite for completeWorkerProfile (8 tests)

**Files:**

- Modify: `packages/api/src/router/__tests__/profile.test.ts`

**Note:** The `profile.completeWorkerProfile` router already exists in `packages/api/src/router/profile.ts`. This task pins its behavior with tests — there's no "red" phase because the implementation is already there. If any test fails, fix the router in this same commit.

- [ ] **Step 1: Read the current `profile.test.ts` to see the existing structure**

```bash
cat packages/api/src/router/__tests__/profile.test.ts
```

The file already has `describe("profile router", ...)` with nested blocks for `setRole` and `getMyProfile`. Add a new nested `describe("completeWorkerProfile", ...)` block.

- [ ] **Step 2: Add the 8 test cases**

Append the following block INSIDE the existing `describe("profile router", () => { ... })`, after the `describe("getMyProfile", ...)` block:

```ts
describe("completeWorkerProfile", () => {
  it("creates a new worker profile with minimum required fields", async () => {
    await caller.profile.setRole({ role: "worker" });

    const result = await caller.profile.completeWorkerProfile({
      fullName: "Jane Doe",
      phone: "+6512345678",
      jobCategories: ["food-and-beverage", "events"],
    });

    expect(result).toEqual({ success: true });

    const profileSnapshot = await caller.profile.getMyProfile();
    expect(profileSnapshot.workerProfile).toMatchObject({
      userId: testUserId,
      fullName: "Jane Doe",
      phone: "+6512345678",
      bio: null,
      photoUrl: null,
    });
    expect(profileSnapshot.profile?.onboardingComplete).toBe(true);
    expect(new Set(profileSnapshot.workerJobCategorySlugs)).toEqual(
      new Set(["food-and-beverage", "events"]),
    );
  });

  it("persists optional bio and photoUrl when provided", async () => {
    await caller.profile.setRole({ role: "worker" });

    await caller.profile.completeWorkerProfile({
      fullName: "Jane Doe",
      phone: "+6512345678",
      bio: "Experienced F&B worker",
      photoUrl: "https://mock.supabase.co/public/avatars/test-xyz.jpg",
      jobCategories: ["events"],
    });

    const profileSnapshot = await caller.profile.getMyProfile();
    expect(profileSnapshot.workerProfile).toMatchObject({
      bio: "Experienced F&B worker",
      photoUrl: "https://mock.supabase.co/public/avatars/test-xyz.jpg",
    });
  });

  it("is idempotent — second call updates fields and replaces categories", async () => {
    await caller.profile.setRole({ role: "worker" });

    await caller.profile.completeWorkerProfile({
      fullName: "Jane",
      phone: "+6512345678",
      jobCategories: ["retail", "cleaning"],
    });

    await caller.profile.completeWorkerProfile({
      fullName: "Jane Smith",
      phone: "+6500000000",
      jobCategories: ["events"],
    });

    const profileSnapshot = await caller.profile.getMyProfile();
    expect(profileSnapshot.workerProfile).toMatchObject({
      fullName: "Jane Smith",
      phone: "+6500000000",
    });
    expect(profileSnapshot.workerJobCategorySlugs).toEqual(["events"]);
  });

  it("rejects when the user has the employer role", async () => {
    await caller.profile.setRole({ role: "employer" });

    await expect(
      caller.profile.completeWorkerProfile({
        fullName: "Jane Doe",
        phone: "+6512345678",
        jobCategories: ["events"],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You must select the worker role first.",
    });
  });

  it("rejects when no role has been set", async () => {
    await expect(
      caller.profile.completeWorkerProfile({
        fullName: "Jane Doe",
        phone: "+6512345678",
        jobCategories: ["events"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects empty jobCategories at input validation", async () => {
    await caller.profile.setRole({ role: "worker" });

    await expect(
      caller.profile.completeWorkerProfile({
        fullName: "Jane Doe",
        phone: "+6512345678",
        jobCategories: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects fullName shorter than 2 characters", async () => {
    await caller.profile.setRole({ role: "worker" });

    await expect(
      caller.profile.completeWorkerProfile({
        fullName: "X",
        phone: "+6512345678",
        jobCategories: ["events"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects unknown job category slugs at schema validation", async () => {
    await caller.profile.setRole({ role: "worker" });

    await expect(
      caller.profile.completeWorkerProfile({
        fullName: "Jane Doe",
        phone: "+6512345678",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jobCategories: ["nonexistent-slug" as any],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
```

- [ ] **Step 3: Run the test file**

```bash
pnpm -F @findgigs/api test profile.test.ts
```

Expected: all 8 new tests + 5 existing tests pass (13 total in the file).

- [ ] **Step 4: If any test fails**

- **Test 1-3 (happy path / idempotency) fails** → likely a bug in the router's transaction logic. Read `packages/api/src/router/profile.ts` and fix. Re-run.
- **Test 4-5 (role checks) fails** → the early `BAD_REQUEST` check is missing or incorrect. Fix the router. Re-run.
- **Test 6-8 (input validation) fails** → the Zod schema may be missing constraints. Check `packages/validators/src/worker-profile.ts` and `packages/validators/src/profile.ts`. Fix. Re-run.
- **"job category not found" errors** → the seed didn't run. Run `pnpm db:seed` and re-run tests.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/router/__tests__/profile.test.ts
git commit -m "test(api): pin completeWorkerProfile behavior with 8 vitest cases"
```

If any router fixes were needed, stage `packages/api/src/router/profile.ts` in the same commit.

---

## Task 4: Install @supabase/supabase-js

**Files:**

- Modify: `packages/api/package.json`

- [ ] **Step 1: Install the dependency**

```bash
pnpm -F @findgigs/api add @supabase/supabase-js
```

Expected: `@supabase/supabase-js` appears under `dependencies` in `packages/api/package.json`.

- [ ] **Step 2: Run typecheck**

```bash
pnpm -F @findgigs/api typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add packages/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add @supabase/supabase-js for storage router"
```

---

## Task 5: Write failing storage router tests (5 tests)

**Files:**

- Create: `packages/api/src/router/__tests__/storage.test.ts`

- [ ] **Step 1: Create the test file**

Create `packages/api/src/router/__tests__/storage.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupTestUser, createTestUser } from "../../__tests__/helpers";

// Hoisted mocks so we can assert on them across tests.
const createSignedUploadUrlMock = vi.fn();
const getPublicUrlMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: createSignedUploadUrlMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  })),
}));

describe("storage router", () => {
  let testUserId: string;
  let caller: Awaited<ReturnType<typeof createTestUser>>["caller"];

  beforeEach(async () => {
    const fixture = await createTestUser();
    testUserId = fixture.userId;
    caller = fixture.caller;

    // Default happy-path mock. Individual tests can override.
    createSignedUploadUrlMock.mockImplementation(async (path: string) => ({
      data: {
        signedUrl: `https://mock.supabase.co/upload/${path}?token=abc`,
        token: "abc",
        path,
      },
      error: null,
    }));
    getPublicUrlMock.mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/public/${path}` },
    }));
  });

  afterEach(async () => {
    createSignedUploadUrlMock.mockReset();
    getPublicUrlMock.mockReset();
    await cleanupTestUser(testUserId);
  });

  describe("getAvatarUploadUrl", () => {
    it("returns a signed upload URL scoped to the authenticated user", async () => {
      const result = await caller.storage.getAvatarUploadUrl();

      expect(result).toEqual({
        uploadUrl: `https://mock.supabase.co/upload/${testUserId}.jpg?token=abc`,
        token: "abc",
        path: `${testUserId}.jpg`,
        publicUrl: `https://mock.supabase.co/public/${testUserId}.jpg`,
      });
    });

    it("calls createSignedUploadUrl with the user-scoped path", async () => {
      await caller.storage.getAvatarUploadUrl();

      expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
        `${testUserId}.jpg`,
        expect.any(Object),
      );
    });

    it("passes { upsert: true } so repeated uploads don't error", async () => {
      await caller.storage.getAvatarUploadUrl();

      expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ upsert: true }),
      );
    });

    it("bubbles Supabase errors up as INTERNAL_SERVER_ERROR", async () => {
      createSignedUploadUrlMock.mockResolvedValueOnce({
        data: null,
        error: { message: "boom", name: "StorageError" },
      });

      await expect(caller.storage.getAvatarUploadUrl()).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: expect.stringContaining("boom"),
      });
    });

    it("is a protected procedure — rejects when there is no session", async () => {
      // Build an unauthenticated caller by reaching through the appRouter.
      const { appRouter } = await import("../../root");
      const { db } = await import("@findgigs/db/client");
      const unauthCaller = appRouter.createCaller({
        db,
        authApi: {} as never,
        session: null,
      } as never);

      await expect(
        unauthCaller.storage.getAvatarUploadUrl(),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});
```

- [ ] **Step 2: Run the test file to verify it fails**

```bash
pnpm -F @findgigs/api test storage.test.ts
```

Expected: tests FAIL with errors like `caller.storage is undefined` or `Cannot read property 'getAvatarUploadUrl' of undefined` — because the storage router doesn't exist yet.

- [ ] **Step 3: Commit (RED phase)**

```bash
git add packages/api/src/router/__tests__/storage.test.ts
git commit -m "test(api): add failing storage router test suite (RED)"
```

---

## Task 6: Implement the storage router

**Files:**

- Create: `packages/api/src/router/storage.ts`
- Modify: `packages/api/src/root.ts`

- [ ] **Step 1: Create `packages/api/src/router/storage.ts`**

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";

import { env } from "../../env";
import { protectedProcedure } from "../trpc";

// Lazy client construction — the mock in storage.test.ts replaces
// `createClient`, so this function returns the mocked client in tests
// and a real client in runtime paths.
type SupabaseClient = ReturnType<typeof createClient>;
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      env.SUPABASE_URL ?? "",
      env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
  }
  return supabaseClient;
}

export const storageRouter = {
  /**
   * Returns a short-lived signed upload URL for the current user's avatar.
   * Path is deterministic — `{userId}.jpg` within the avatars bucket —
   * so every upload overwrites the previous one, bounding orphans at
   * ~1 per abandoned user.
   *
   * The public URL is assembled server-side and returned to the client,
   * which passes it to profile.completeWorkerProfile after the PUT completes.
   */
  getAvatarUploadUrl: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const path = `${userId}.jpg`;
    const bucket = env.SUPABASE_AVATAR_BUCKET;

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to create upload URL: ${error?.message ?? "unknown error"}`,
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the router in `packages/api/src/root.ts`**

Replace the current contents of `packages/api/src/root.ts` with:

```ts
import { authRouter } from "./router/auth";
import { postRouter } from "./router/post";
import { profileRouter } from "./router/profile";
import { storageRouter } from "./router/storage";
import { venueRouter } from "./router/venue";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  post: postRouter,
  profile: profileRouter,
  storage: storageRouter,
  venue: venueRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Run the storage router tests — should PASS now**

```bash
pnpm -F @findgigs/api test storage.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 4: Run the full api test suite to confirm nothing regressed**

```bash
pnpm -F @findgigs/api test
```

Expected: all tests pass (existing smoke + profile + new storage).

- [ ] **Step 5: Commit (GREEN phase)**

```bash
git add packages/api/src/router/storage.ts packages/api/src/root.ts
git commit -m "feat(api): storage router with getAvatarUploadUrl (GREEN)"
```

---

## Task 7: Install mobile deps + configure expo-image-picker plugin

**Files:**

- Modify: `apps/mobile/package.json`, `apps/mobile/app.config.ts`

- [ ] **Step 1: Install mobile dependencies via expo CLI**

```bash
cd apps/mobile && npx expo install expo-image-picker expo-image-manipulator && cd ../..
```

Using `expo install` (instead of `pnpm add`) so Expo resolves versions compatible with SDK 55.

Expected: both packages appear under `dependencies` in `apps/mobile/package.json`.

- [ ] **Step 2: Add expo-image-picker plugin config to `app.config.ts`**

In `apps/mobile/app.config.ts`, extend the `plugins` array. Replace the current `plugins` array with:

```ts
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#E4E4E7",
        image: "./assets/icon-light.png",
        dark: {
          backgroundColor: "#18181B",
          image: "./assets/icon-dark.png",
        },
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "FindGigs needs access to your photos so you can upload a profile picture.",
        cameraPermission:
          "FindGigs needs access to your camera so you can take a profile picture.",
      },
    ],
  ],
```

- [ ] **Step 3: Run mobile typecheck**

```bash
pnpm -F @findgigs/mobile typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.config.ts pnpm-lock.yaml
git commit -m "chore(mobile): add expo-image-picker + expo-image-manipulator with iOS permission strings"
```

---

## Task 8: Extend AuthGuard with rule 4

**Files:**

- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Add the `WORKER_PROFILE_SEGMENT` constant**

In `apps/mobile/src/app/_layout.tsx`, find the existing line:

```ts
const ROLE_SELECT_SEGMENT = "role-select";
```

Add a sibling constant right below it:

```ts
const WORKER_PROFILE_SEGMENT = "worker-profile";
```

- [ ] **Step 2: Extend the `useEffect` inside `AuthGuard` with rule 4**

Inside the `AuthGuard` component's `useEffect`, find the existing rule 3 block (it ends with `router.replace("/role-select"); return;`). Add a new block immediately after it, BEFORE the closing `}` of the `useEffect` callback:

```ts
// Rule 4 (FIN-9): session, worker profile exists, but onboarding
// not yet complete → send them to the worker profile creation form.
// Same fail-open stance as rule 3 — only redirect when profileData
// has resolved.
if (
  session &&
  !profilePending &&
  profileData?.profile?.role === "worker" &&
  !profileData.profile.onboardingComplete &&
  !inWorkerProfile
) {
  router.replace("/worker-profile");
  return;
}
```

Also update the segment computation block near the top of the `useEffect`:

```ts
const inAuthGroup = segments[0] === "(auth)";
const inRoleSelect = segments[0] === ROLE_SELECT_SEGMENT;
const inWorkerProfile = segments[0] === WORKER_PROFILE_SEGMENT;
```

- [ ] **Step 3: Run mobile typecheck**

```bash
pnpm -F @findgigs/mobile typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): AuthGuard rule 4 — route worker with incomplete onboarding to /worker-profile"
```

---

## Task 9: Rewrite `worker-profile.tsx` scaffold with TanStack React Form

**Files:**

- Rewrite: `apps/mobile/src/app/worker-profile.tsx`

This task ships a working scaffold: header, all 5 fields as plain inputs (no chips, no photo picker), submit wired to `completeWorkerProfile`. Proves the TanStack Form + Zod wiring works on RN before adding more complex components.

- [ ] **Step 1: Replace `apps/mobile/src/app/worker-profile.tsx` entirely**

```tsx
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { JobCategorySlug } from "@findgigs/validators";
import { WorkerProfileSchema } from "@findgigs/validators";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import { trpc } from "~/utils/api";

export default function WorkerProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const completeWorkerProfileMutation = useMutation({
    ...trpc.profile.completeWorkerProfile.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.profile.getMyProfile.queryKey(),
      });
      router.replace("/");
    },
    onError: (error) => {
      Alert.alert("Couldn't save profile", error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      fullName: "",
      phone: "",
      bio: "",
      photoUrl: undefined as string | undefined,
      // Hardcoded placeholder for scaffold — replaced by CategoryChips in Task 10
      jobCategories: ["events"] as JobCategorySlug[],
    },
    validators: {
      onChange: WorkerProfileSchema,
    },
    onSubmit: ({ value }) => {
      completeWorkerProfileMutation.mutate({
        fullName: value.fullName,
        phone: value.phone,
        bio: value.bio.trim() ? value.bio : undefined,
        photoUrl: value.photoUrl,
        jobCategories: value.jobCategories,
      });
    },
  });

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-6 px-6 pt-10">
            {/* Header */}
            <View className="gap-2">
              <Text className="text-foreground text-2xl font-bold">
                Set up your profile
              </Text>
              <Text className="text-muted-foreground text-sm">
                Help employers get to know you
              </Text>
            </View>

            {/* Full Name */}
            <form.Field name="fullName">
              {(field) => (
                <LabeledField
                  label="Full Name"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="Jane Doe"
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

            {/* Phone */}
            <form.Field name="phone">
              {(field) => (
                <LabeledField
                  label="Phone Number"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="+65 1234 5678"
                  keyboardType="phone-pad"
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

            {/* Bio */}
            <form.Field name="bio">
              {(field) => (
                <LabeledField
                  label="Short Bio (Optional)"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  placeholder="Tell employers a bit about yourself"
                  multiline
                  maxLength={300}
                  counter
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

            {/* Placeholder for chips — Task 10 replaces this */}
            <View className="gap-2">
              <Text className="text-foreground text-sm font-medium">
                Job categories (scaffold — placeholder)
              </Text>
              <Text className="text-muted-foreground text-xs">
                Currently hardcoded to ["events"]. Task 10 replaces this with a
                tappable chip grid.
              </Text>
            </View>

            {/* Submit button */}
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  size="lg"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    completeWorkerProfileMutation.isPending
                  }
                  onPress={() => form.handleSubmit()}
                >
                  <Text className="text-primary-foreground font-semibold">
                    {completeWorkerProfileMutation.isPending
                      ? "Saving…"
                      : "Complete Profile"}
                  </Text>
                </Button>
              )}
            </form.Subscribe>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// LabeledField — internal helper for labeled TextInput + error display.
// Extracted to keep field usages terse.
// ---------------------------------------------------------------------------

interface LabeledFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
  maxLength?: number;
  counter?: boolean;
  errors: readonly unknown[];
}

function LabeledField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  maxLength,
  counter,
  errors,
}: LabeledFieldProps) {
  const hasError = errors.length > 0;
  return (
    <View className="gap-1.5">
      <Text className="text-foreground text-sm font-medium">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        maxLength={maxLength}
        className={cn(
          "border-border bg-card text-foreground rounded-2xl border px-4 py-3 text-base",
          multiline && "h-24",
          hasError && "border-destructive",
        )}
      />
      {counter && maxLength && (
        <Text className="text-muted-foreground text-right text-xs">
          {value.length} / {maxLength}
        </Text>
      )}
      {hasError && (
        <Text className="text-destructive text-xs">
          {String(errors[0] ?? "")}
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Run mobile typecheck**

```bash
pnpm -F @findgigs/mobile typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Smoke test manually**

Start the mobile dev server:

```bash
pnpm -F @findgigs/mobile dev
```

Open the app in Expo Go (or simulator). Sign up / sign in as a new test user. On `/role-select`, pick "Worker" → the AuthGuard should now route you to `/worker-profile`. You should see the scaffold header, three text fields, and a disabled submit button (because the hardcoded `jobCategories: ["events"]` is valid but `fullName` is empty).

Fill in:

- Full Name: `Test Worker`
- Phone: `+6512345678`

Tap "Complete Profile". Expected: screen navigates to home (`/`), which is the Tailwind swatch placeholder. Verify in DB that `worker_profile` has the row + `profile.onboarding_complete = true`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/worker-profile.tsx
git commit -m "feat(mobile): worker-profile scaffold with TanStack Form + Zod"
```

---

## Task 10: CategoryChips component

**Files:**

- Modify: `apps/mobile/src/app/worker-profile.tsx`

- [ ] **Step 1: Add an import for `JOB_CATEGORIES`**

In `apps/mobile/src/app/worker-profile.tsx`, update the validator import to include `JOB_CATEGORIES`:

```ts
import type { JobCategorySlug } from "@findgigs/validators";
import { JOB_CATEGORIES, WorkerProfileSchema } from "@findgigs/validators";
```

Also add `Pressable` to the `react-native` import if it's not already there:

```ts
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
```

- [ ] **Step 2: Change the `jobCategories` default from `["events"]` to empty array**

In the `useForm` call, update:

```ts
    defaultValues: {
      fullName: "",
      phone: "",
      bio: "",
      photoUrl: undefined as string | undefined,
      jobCategories: [] as JobCategorySlug[],
    },
```

- [ ] **Step 3: Replace the scaffold placeholder block with a `<form.Field>` wrapping `CategoryChips`**

Find the existing `{/* Placeholder for chips — Task 10 replaces this */}` block in the JSX and replace the entire `<View>` (label + description) with:

```tsx
<form.Field name="jobCategories">
  {(field) => (
    <CategoryChips
      value={field.state.value}
      onChange={field.handleChange}
      errors={field.state.meta.errors}
    />
  )}
</form.Field>
```

- [ ] **Step 4: Add the `CategoryChips` component at the bottom of the file**

Append after the `LabeledField` component:

```tsx
// ---------------------------------------------------------------------------
// CategoryChips — multi-select chip grid, source of truth is JOB_CATEGORIES
// from @findgigs/validators (same constant the seed script uses).
// ---------------------------------------------------------------------------

interface CategoryChipsProps {
  value: JobCategorySlug[];
  onChange: (next: JobCategorySlug[]) => void;
  errors: readonly unknown[];
}

function CategoryChips({ value, onChange, errors }: CategoryChipsProps) {
  const selected = new Set(value);
  const hasError = errors.length > 0;

  return (
    <View className="gap-3">
      <Text className="text-foreground text-sm font-medium">
        What kind of work interests you?
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {JOB_CATEGORIES.map((cat) => {
          const isSelected = selected.has(cat.slug);
          return (
            <Pressable
              key={cat.slug}
              onPress={() => {
                const next = new Set(selected);
                if (isSelected) next.delete(cat.slug);
                else next.add(cat.slug);
                onChange(Array.from(next));
              }}
              className={cn(
                "rounded-full border px-4 py-2",
                isSelected
                  ? "border-primary bg-accent"
                  : "border-border bg-card",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : "text-foreground",
                )}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hasError && (
        <Text className="text-destructive text-xs">
          Select at least one job category
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 5: Run mobile typecheck**

```bash
pnpm -F @findgigs/mobile typecheck
```

Expected: exit code 0.

- [ ] **Step 6: Smoke test**

Restart the mobile dev server. On `/worker-profile`:

- Verify 8 chips render in a flex-wrap grid, all unselected
- Tap "Events" and "Retail" → both chips highlight (blue border + accent background)
- Tap "Events" again → it de-selects
- Submit with zero chips selected → inline error "Select at least one job category" appears
- Submit with at least one chip + valid name + phone → form submits, lands on home
- Verify in DB: `worker_job_category` rows match the selected slugs

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/app/worker-profile.tsx
git commit -m "feat(mobile): CategoryChips multi-select grid for worker profile"
```

---

## Task 11: PhotoPicker component (library flow + upload pipeline)

**Files:**

- Modify: `apps/mobile/src/app/worker-profile.tsx`

This task adds the photo picker with the library-only path and the full upload pipeline. Camera path is added in Task 12.

- [ ] **Step 1: Add imports**

At the top of `apps/mobile/src/app/worker-profile.tsx`, add:

```ts
import {
  ActionSheetIOS,
  ActivityIndicator,
  Image,
  // ...existing imports:
} from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
```

The full `react-native` import should look like:

```ts
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
```

- [ ] **Step 2: Add a `photoStatus` state + `isUploading` flag at the top of `WorkerProfileScreen`**

Inside `WorkerProfileScreen`, after the `const router = useRouter();` / `const queryClient = ...;` lines, add:

```ts
const [photoStatus, setPhotoStatus] = useState<PhotoStatus>("idle");
const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
const isUploading = photoStatus === "uploading";
```

- [ ] **Step 3: Add the `getAvatarUploadUrl` mutation inside `WorkerProfileScreen`**

Just after `completeWorkerProfileMutation`:

```ts
const getAvatarUploadUrlMutation = useMutation({
  ...trpc.storage.getAvatarUploadUrl.mutationOptions(),
});
```

- [ ] **Step 4: Insert `<PhotoPicker>` into the JSX**

In the JSX, between the `Header` block and the `fullName` `<form.Field>`, insert:

```tsx
<PhotoPicker
  status={photoStatus}
  localUri={photoLocalUri}
  onStatusChange={setPhotoStatus}
  onLocalUriChange={setPhotoLocalUri}
  onPublicUrl={(url) => form.setFieldValue("photoUrl", url ?? undefined)}
  getUploadUrl={() => getAvatarUploadUrlMutation.mutateAsync()}
/>
```

- [ ] **Step 5: Add `isUploading` to the submit button's disabled expression**

Update the existing `Button` `disabled` prop:

```tsx
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    isUploading ||
                    completeWorkerProfileMutation.isPending
                  }
```

- [ ] **Step 6: Add the `PhotoStatus` type and `PhotoPicker` component at the bottom of the file**

After `CategoryChips`, append:

```tsx
// ---------------------------------------------------------------------------
// PhotoPicker — single-slot avatar upload with state machine.
//
// Status invariant: form.photoUrl is set only in the 'success' state.
// Any other state means the server has no photo for this user.
// ---------------------------------------------------------------------------

type PhotoStatus = "idle" | "uploading" | "success" | "error";

interface PhotoPickerProps {
  status: PhotoStatus;
  localUri: string | null;
  onStatusChange: (status: PhotoStatus) => void;
  onLocalUriChange: (uri: string | null) => void;
  onPublicUrl: (url: string | null) => void;
  getUploadUrl: () => Promise<{
    uploadUrl: string;
    token: string;
    path: string;
    publicUrl: string;
  }>;
}

function PhotoPicker({
  status,
  localUri,
  onStatusChange,
  onLocalUriChange,
  onPublicUrl,
  getUploadUrl,
}: PhotoPickerProps) {
  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo permission needed",
        "Grant photo library access to add a profile photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) await onAsset(asset.uri);
  };

  const onAsset = async (uri: string) => {
    onLocalUriChange(uri);
    onStatusChange("uploading");

    try {
      // 1. Re-encode JPEG + resize to 800px
      const manipulated = await manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: SaveFormat.JPEG },
      );

      // 2. Request signed upload URL
      const { uploadUrl, publicUrl } = await getUploadUrl();

      // 3. Read compressed file bytes and PUT to signed URL
      const fileResponse = await fetch(manipulated.uri);
      const blob = await fileResponse.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // 4. Commit to form state only on success
      onPublicUrl(publicUrl);
      onStatusChange("success");
    } catch (err) {
      console.warn("[worker-profile] photo upload failed:", err);
      onPublicUrl(null);
      onStatusChange("error");
    }
  };

  const showActionSheet = () => {
    if (status === "uploading") return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Choose from Library", "Cancel"],
          cancelButtonIndex: 1,
        },
        (index) => {
          if (index === 0) void pickFromLibrary();
        },
      );
    } else {
      Alert.alert("Add Profile Photo", undefined, [
        { text: "Choose from Library", onPress: () => void pickFromLibrary() },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const removePhoto = () => {
    onLocalUriChange(null);
    onPublicUrl(null);
    onStatusChange("idle");
  };

  return (
    <View className="items-center gap-2">
      <Pressable onPress={showActionSheet} disabled={status === "uploading"}>
        <View className="bg-muted relative h-24 w-24 items-center justify-center overflow-hidden rounded-full">
          {localUri ? (
            <Image
              source={{ uri: localUri }}
              className="h-24 w-24 rounded-full"
            />
          ) : (
            <Text className="text-4xl">📷</Text>
          )}
          {status === "uploading" && (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
              <ActivityIndicator color="white" />
            </View>
          )}
          {status === "error" && (
            <View className="bg-destructive/60 absolute inset-0 items-center justify-center rounded-full">
              <Text className="text-xl">⚠️</Text>
            </View>
          )}
        </View>
      </Pressable>
      {status === "idle" && (
        <Text className="text-primary text-sm">
          Add a photo to improve your chances
        </Text>
      )}
      {status === "uploading" && (
        <Text className="text-muted-foreground text-sm">Uploading…</Text>
      )}
      {status === "success" && (
        <Pressable onPress={showActionSheet}>
          <Text className="text-primary text-sm">Change photo</Text>
        </Pressable>
      )}
      {status === "error" && (
        <View className="flex-row gap-4">
          <Pressable onPress={showActionSheet}>
            <Text className="text-primary text-sm font-medium">Retry</Text>
          </Pressable>
          <Pressable onPress={removePhoto}>
            <Text className="text-destructive text-sm font-medium">Remove</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 7: Run mobile typecheck**

```bash
pnpm -F @findgigs/mobile typecheck
```

Expected: exit code 0.

- [ ] **Step 8: Smoke test (library-only for now)**

**Prerequisite:** real Supabase project configured in local `.env` (not the placeholder values) AND the `avatars` bucket created in the Supabase dashboard as a public bucket.

Restart the mobile dev server. On `/worker-profile`:

- Verify the avatar area shows a camera emoji + "Add a photo to improve your chances"
- Tap the avatar → ActionSheet shows "Choose from Library" and "Cancel"
- Tap "Choose from Library" → OS permission dialog → grant → photo library opens
- Pick a photo → spinner overlay appears on avatar → ~1-3s later → clean preview + "Change photo" link below
- Verify the file exists in Supabase dashboard → Storage → avatars bucket → `{userId}.jpg`
- Submit form with valid other fields → lands on home
- Verify `worker_profile.photo_url` in DB matches the public URL

**Error path test:** set the local `.env` to an invalid `SUPABASE_SERVICE_ROLE_KEY`, restart dev server, try to pick a photo → avatar should show ⚠️ overlay + "Retry / Remove" options.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/app/worker-profile.tsx
git commit -m "feat(mobile): PhotoPicker with library flow + upload pipeline"
```

---

## Task 12: PhotoPicker camera flow

**Files:**

- Modify: `apps/mobile/src/app/worker-profile.tsx`

- [ ] **Step 1: Add `pickFromCamera` to the `PhotoPicker` component**

Inside the `PhotoPicker` function, add a new helper right above `pickFromLibrary`:

```tsx
const pickFromCamera = async () => {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "Camera permission needed",
      "Grant camera access to take a profile photo.",
    );
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (asset) await onAsset(asset.uri);
};
```

- [ ] **Step 2: Update `showActionSheet` to include "Take Photo"**

Replace the existing `showActionSheet` function body with:

```tsx
const showActionSheet = () => {
  if (status === "uploading") return;
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Take Photo", "Choose from Library", "Cancel"],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) void pickFromCamera();
        if (index === 1) void pickFromLibrary();
      },
    );
  } else {
    Alert.alert("Add Profile Photo", undefined, [
      { text: "Take Photo", onPress: () => void pickFromCamera() },
      { text: "Choose from Library", onPress: () => void pickFromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }
};
```

- [ ] **Step 3: Run mobile typecheck**

```bash
pnpm -F @findgigs/mobile typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Smoke test camera path**

Restart the mobile dev server. On `/worker-profile`:

- Tap avatar → ActionSheet now shows three options: "Take Photo" / "Choose from Library" / "Cancel"
- Tap "Take Photo" → permission dialog (first time) → grant → camera opens
- Take a photo → same crop/edit flow → spinner → preview
- Verify upload to Supabase + submit flow works

**Note:** camera path only works on a real device or simulator with camera enabled — iOS simulator has no camera, so test on a real iPhone or use "Choose from Library" as a substitute while in simulator.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/worker-profile.tsx
git commit -m "feat(mobile): PhotoPicker camera capture path"
```

---

## Task 13: README Supabase Storage setup section

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Find the environment setup section in README**

```bash
grep -n "env" README.md | head -20
```

Look for the existing "Environment Setup" or "Setup" section. Add a new subsection under it (or create one if missing).

- [ ] **Step 2: Add the Supabase Storage setup subsection**

Append to the environment setup section of `README.md`:

````markdown
### One-time Supabase Storage setup

FIN-9 (worker profile photo upload) requires a Supabase Storage bucket. Do this once per Supabase project:

1. **Create the `avatars` bucket.** In the Supabase dashboard → Storage → New bucket:
   - Name: `avatars`
   - Public: ✅ (avatars are shown to employers, no need for signed read URLs)
   - File size limit: `5 MB`
   - Allowed MIME types: `image/jpeg`
   - No RLS policies needed — the bucket is public and server writes use the service role key.

2. **Copy credentials into your local `.env`:**
   ```dotenv
   SUPABASE_URL="https://<your-project-ref>.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
   SUPABASE_AVATAR_BUCKET="avatars"
   ```
````

Find `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard → Project Settings → API.

3. **For production**, add the same vars to Vercel:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add SUPABASE_AVATAR_BUCKET
   ```

Tests in CI do NOT need real Supabase credentials — the `.env.example` ships placeholder values that pass schema validation, and `@supabase/supabase-js` is mocked at the vitest level in `storage.test.ts`.

````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document one-time Supabase Storage bucket setup"
````

---

## Task 14: Final pre-push CI gate

**Files:** none (checklist task)

This task enforces the pre-PR CI gate lesson from FIN-8. Run the **full** set locally, fix any failures, only push when all four pass.

- [ ] **Step 1: Run the full CI gate via turbo**

```bash
pnpm exec turbo run lint typecheck build test
```

Expected: all four tasks pass across all packages. Exit code 0.

- [ ] **Step 2: If `lint` fails**

Read the errors. Common fixes:

- `no-non-null-assertion` → add runtime guard (`if (!x) throw new Error(...)`)
- `prefer-optional-chain` → use `x?.y` instead of `x && x.y`
- `no-misused-promises` → move async callbacks to options (not inline), or wrap in `() => void asyncFn()`

Fix, then re-run: `pnpm exec turbo run lint`

- [ ] **Step 3: If `typecheck` fails**

Read the errors. Common fixes:

- `TS2742` (inferred type cannot be named) → add explicit type annotation (`type Foo = ReturnType<...>` + explicit return type)
- Missing imports → add `import type { ... } from "..."`

Fix, then re-run: `pnpm exec turbo run typecheck`

- [ ] **Step 4: If `build` fails**

Critical: `build` runs `tsc` with `declaration: true`, so it catches declaration-emit errors that `typecheck` (which uses `--emitDeclarationOnly false`) misses. Usually TS2742 or missing exports.

Fix, then re-run: `pnpm exec turbo run build`

- [ ] **Step 5: If `test` fails**

Read vitest output. Common fixes:

- Seed not run → the test depends on `job_category` rows existing. Check `pnpm db:seed` works locally, re-run test.
- Database connection refused → Docker Postgres not running. `bash scripts/setup-db.sh`.
- Mock not applied → vi.mock hoisting issue; ensure the mock is at the TOP of the file, not inside a describe/it.

Fix, then re-run: `pnpm exec turbo run test`

- [ ] **Step 6: All four pass → push the branch**

```bash
git push -u origin bubuding0809/fin-9-worker-profile-creation
```

- [ ] **Step 7: Open a PR**

```bash
gh pr create --title "feat(mobile): FIN-9 worker profile creation + Supabase Storage avatars" --body "$(cat <<'EOF'
## Summary
- New worker profile creation screen (TanStack React Form) with name / phone / bio / category chips / photo
- Supabase Storage avatar upload via new `storage.getAvatarUploadUrl` tRPC mutation + deterministic `avatars/{userId}.jpg` path
- `JobCategory` seed script (`pnpm db:seed`) + CI wiring in `pr-gate.yml`
- AuthGuard rule 4: route `worker && !onboardingComplete` to `/worker-profile`
- vitest coverage: 8 new `completeWorkerProfile` tests, 5 new `storage.getAvatarUploadUrl` tests

Closes FIN-9.

## Test Plan
- [ ] `pnpm exec turbo run lint typecheck build test` passes locally
- [ ] CI gate (lint + format + typecheck + build + test) passes
- [ ] Manual smoke: sign up → role-select worker → fill form + pick photo from library → submit → land on home
- [ ] Manual smoke: take photo from camera → upload → submit
- [ ] Manual smoke: skip photo entirely → submit → lands on home with `photo_url = null`
- [ ] Manual smoke: upload fails (break `SUPABASE_SERVICE_ROLE_KEY` temporarily) → error state → Retry/Remove works
EOF
)"
```

---

## Self-review notes (post-plan)

**Spec coverage check:**

| Spec section                    | Implementation tasks                        |
| ------------------------------- | ------------------------------------------- |
| Job category seed               | Task 2                                      |
| Env vars                        | Task 1                                      |
| Storage router                  | Tasks 4, 5, 6                               |
| completeWorkerProfile tests     | Task 3                                      |
| AuthGuard rule 4                | Task 8                                      |
| worker-profile.tsx scaffold     | Task 9                                      |
| CategoryChips                   | Task 10                                     |
| PhotoPicker (library + upload)  | Task 11                                     |
| PhotoPicker camera path         | Task 12                                     |
| expo-image-picker plugin config | Task 7                                      |
| README Supabase setup           | Task 13                                     |
| Full CI gate before push        | Task 14                                     |
| Branch name matching Linear     | covered by existing branch + Task 14 step 6 |

Every acceptance criterion in the spec is covered by at least one task.

**Type consistency check:** The types used across tasks (`JobCategorySlug`, `PhotoStatus`, `PhotoPickerProps`, `LabeledFieldProps`, `CategoryChipsProps`, return type of `getAvatarUploadUrl`) are defined in the task that first introduces them and reused consistently in later tasks.

**No placeholders:** every step shows the actual code or command the engineer should run.
