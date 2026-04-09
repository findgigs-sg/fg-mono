# FIN-8 Role Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the role-select screen + a minimal AuthGuard gate + placeholder destinations for FIN-8, backed by 5 strict-TDD vitest tests exercising `profile.setRole` and `profile.getMyProfile`.

**Architecture:** Test infrastructure first (env wiring, helper, tests), then the static destinations, then the interactive screen, then the routing gate. Each task produces a green commit that builds and typechecks on its own.

**Tech Stack:** vitest, drizzle-orm, `@trpc/server` (tests); Expo Router, NativeWind v5 preview, `@tanstack/react-query`, `@trpc/tanstack-react-query` with `createTRPCOptionsProxy` pattern (screens); `lucide` icons already present via the react-native icon font.

**Spec correction note:** The spec (`docs/superpowers/specs/2026-04-09-fin-8-role-selection-design.md`) uses legacy `trpc.x.useMutation()` / `trpc.x.useQuery()` syntax in its code snippets. The actual project exposes tRPC via `createTRPCOptionsProxy` (`apps/mobile/src/utils/api.tsx`), so the correct pattern is:

```tsx
// Mutation
const setRoleMutation = useMutation(trpc.profile.setRole.mutationOptions());
setRoleMutation.mutate(input, { onSuccess, onError });

// Query
const { data, isPending } = useQuery({
  ...trpc.profile.getMyProfile.queryOptions(),
  enabled: !!session,
});
```

Reference: `apps/mobile/src/app/post/[id].tsx` line 9 uses `trpc.post.byId.queryOptions({ id })`.

---

## File Structure

### Created (4 files)

| Path                                                | Responsibility                                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api/src/__tests__/helpers.ts`             | `createTestUser()` / `cleanupTestUser()` — inserts a real `user` row, returns an `appRouter.createCaller()` bound to that user's fake session |
| `packages/api/src/router/__tests__/profile.test.ts` | The 5 vitest tests covering `profile.setRole` (new, idempotent, conflict) and `profile.getMyProfile` (null state, populated)                  |
| `apps/mobile/src/app/worker-profile.tsx`            | Placeholder destination for `role=worker`. Title + "Coming soon" + sign-out                                                                   |
| `apps/mobile/src/app/employer-profile.tsx`          | Placeholder destination for `role=employer`. Same shape as worker-profile                                                                     |

### Modified (3 files)

| Path                                  | Change                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/api/package.json`           | `test` script: `"vitest run"` → `"dotenv -e ../../.env -- vitest run"` (so `DATABASE_URL` loads) |
| `apps/mobile/src/app/role-select.tsx` | Replace stub body with full UI (header + 2 role cards + Continue button + mutation)              |
| `apps/mobile/src/app/_layout.tsx`     | Extend `AuthGuard` with `getMyProfile` query + redirect to `/role-select` when profile is null   |

### Not touched (final from last round)

- `packages/db/src/schema.ts`
- `packages/validators/src/*`
- `packages/api/src/root.ts`
- `packages/api/src/router/profile.ts` — **only touched reactively if tests surface bugs**
- `apps/mobile/src/app/(auth)/*`
- `apps/mobile/src/app/index.tsx` — deliberately stays as the theme-test content from a previous session

---

## Task 1: Wire DATABASE_URL into vitest

**Files:**

- Modify: `packages/api/package.json:12-20` (the scripts + devDependencies blocks)

**Why:** The existing `packages/api/package.json` has `"test": "vitest run"` with no env loading. Vitest runs in a subprocess with a clean environment, so `process.env.DATABASE_URL` is `undefined`, and any test that touches `db` crashes during import of `@findgigs/db/client` (which throws "DATABASE_URL is not set"). Matching the `@findgigs/db` package's `with-env` pattern (`dotenv -e ../../.env -- <cmd>`) is the minimum fix. `dotenv-cli` is already installed at the repo root (root `devDependencies`) and pnpm's script PATH resolution walks up, so no new dep declaration is needed.

- [ ] **Step 1.1: Read current scripts in `packages/api/package.json`**

Run: `cat packages/api/package.json`
Expected: script block showing `"test": "vitest run"`.

- [ ] **Step 1.2: Update the `test` script**

Edit `packages/api/package.json`. Change the scripts block so `test` loads the root `.env`:

```json
"scripts": {
  "build": "tsc",
  "clean": "git clean -xdf .cache .turbo dist node_modules",
  "dev": "tsc",
  "format": "prettier --check . --ignore-path ../../.gitignore",
  "lint": "eslint --flag unstable_native_nodejs_ts_config",
  "test": "dotenv -e ../../.env -- vitest run",
  "typecheck": "tsc --noEmit --emitDeclarationOnly false"
}
```

Only the `test` line changes. Leave everything else alone.

- [ ] **Step 1.3: Verify the smoke test still runs with env loaded**

Run: `pnpm -F @findgigs/api test`
Expected: 1 test passes (the pre-existing `smoke.test.ts: smoke test > should pass`). No "DATABASE_URL is not set" errors.

If the smoke test itself fails, something is wrong with env loading — check that `dotenv` is on PATH (`pnpm -F @findgigs/api exec which dotenv` should point at `.../node_modules/.bin/dotenv`).

- [ ] **Step 1.4: Commit**

```bash
git add packages/api/package.json
git commit -m "test(api): load DATABASE_URL via dotenv in vitest script

Matches the with-env pattern used by @findgigs/db. Required
before any router test can import @findgigs/db/client without
tripping the 'DATABASE_URL is not set' throw."
```

---

## Task 2: Create the test helper

**Files:**

- Create: `packages/api/src/__tests__/helpers.ts`

**Why:** Every router test needs an authenticated user row + a tRPC caller bound to that user. Centralizing this in one helper means each test file is just `beforeEach(createTestUser)` / `afterEach(cleanupTestUser)` instead of 30 lines of fixture boilerplate. Cascade-deletes on `user` wipe all dependent tables (profile, worker_profile, employer_profile, venue, worker_job_category), so a single `DELETE FROM "user"` is enough cleanup.

- [ ] **Step 2.1: Create the helper file**

Create `packages/api/src/__tests__/helpers.ts` with exactly this content:

```ts
import { randomUUID } from "node:crypto";

import { eq } from "@findgigs/db";
import { db } from "@findgigs/db/client";
import { user } from "@findgigs/db/schema";

import { appRouter } from "../root";

/**
 * Inserts a fresh user with a `test-<uuid>` id and returns a tRPC caller
 * whose session is scoped to that user. Cleanup is the caller's
 * responsibility — call `cleanupTestUser(userId)` in `afterEach`.
 */
export async function createTestUser() {
  const userId = `test-${randomUUID()}`;
  const now = new Date();

  await db.insert(user).values({
    id: userId,
    name: "Test User",
    email: `${userId}@test.local`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  // The profile router only reads ctx.session.user.id, so the rest of the
  // Session object is a minimal fixture. authApi is not touched by profile
  // procedures — we pass an empty object.
  const caller = appRouter.createCaller({
    db,
    authApi: {} as never,
    session: {
      user: {
        id: userId,
        name: "Test User",
        email: `${userId}@test.local`,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      },
      session: {
        id: `session-${userId}`,
        userId,
        token: "test-token",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        ipAddress: null,
        userAgent: null,
        createdAt: now,
        updatedAt: now,
      },
    },
  } as never);

  return { userId, caller };
}

/**
 * Cascade-deletes the test user. Removes every downstream row
 * (profile, worker_profile, employer_profile, worker_job_category, venue)
 * via the `ON DELETE CASCADE` FKs defined in packages/db/src/schema.ts.
 */
export async function cleanupTestUser(userId: string) {
  await db.delete(user).where(eq(user.id, userId));
}
```

The two `as never` casts are intentional: `authApi` is unused by the profile router, and the full `Session` type from Better Auth is larger than our fixture needs. `as never` silences TypeScript without introducing `any` in general code. Tests are the one place this is acceptable.

- [ ] **Step 2.2: Typecheck the helper**

Run: `pnpm -F @findgigs/api typecheck`
Expected: passes silently (exit 0). If you see a type error on `appRouter.createCaller(...)`, the context shape changed since this plan was written — read `packages/api/src/trpc.ts` `createTRPCContext` return type and reshape the fixture to match.

- [ ] **Step 2.3: Commit**

```bash
git add packages/api/src/__tests__/helpers.ts
git commit -m "test(api): add createTestUser/cleanupTestUser helpers

Used by the upcoming profile router tests and any future
router tests that need an authenticated caller. Cascade-delete
on user cleans up every dependent row via schema FKs."
```

---

## Task 3: Write the failing tests (strict TDD)

**Files:**

- Create: `packages/api/src/router/__tests__/profile.test.ts`

**Why:** Per the spec's strict-TDD decision, we write all 5 tests before any implementation changes. In this case the router already exists from the previous session, so "strict TDD" collapses into "characterization tests first, confirm they describe reality, then lock them in". If any test fails, fix the router — don't weaken the test.

- [ ] **Step 3.1: Create the test file**

Create `packages/api/src/router/__tests__/profile.test.ts` with exactly this content:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupTestUser, createTestUser } from "../../__tests__/helpers";

describe("profile router", () => {
  let testUserId: string;
  let caller: Awaited<ReturnType<typeof createTestUser>>["caller"];

  beforeEach(async () => {
    const fixture = await createTestUser();
    testUserId = fixture.userId;
    caller = fixture.caller;
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  describe("setRole", () => {
    it("creates a new profile with the given role", async () => {
      const profile = await caller.profile.setRole({ role: "worker" });
      expect(profile).toMatchObject({
        userId: testUserId,
        role: "worker",
        onboardingComplete: false,
      });
      expect(profile?.id).toBeDefined();
    });

    it("is idempotent when called twice with the same role", async () => {
      const first = await caller.profile.setRole({ role: "employer" });
      const second = await caller.profile.setRole({ role: "employer" });
      expect(second?.id).toBe(first?.id);
      expect(second?.role).toBe("employer");
    });

    it("throws CONFLICT when called with a different role", async () => {
      await caller.profile.setRole({ role: "worker" });
      await expect(
        caller.profile.setRole({ role: "employer" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  });

  describe("getMyProfile", () => {
    it("returns null profile when no role has been set", async () => {
      const result = await caller.profile.getMyProfile();
      expect(result.profile).toBeNull();
      expect(result.workerProfile).toBeNull();
      expect(result.employerProfile).toBeNull();
      expect(result.workerJobCategorySlugs).toEqual([]);
      expect(result.venues).toEqual([]);
    });

    it("returns the profile after setRole", async () => {
      await caller.profile.setRole({ role: "worker" });
      const result = await caller.profile.getMyProfile();
      expect(result.profile).toMatchObject({
        userId: testUserId,
        role: "worker",
        onboardingComplete: false,
      });
    });
  });
});
```

- [ ] **Step 3.2: Run the tests**

Run: `pnpm -F @findgigs/api test`

Expected outcomes in order of likelihood:

**(A) Smoke test + 5 profile tests all pass (6 passing total).** The router implementation from the previous session is correct. Proceed to Step 3.4.

**(B) Some profile tests fail.** This means the router has a bug the tests caught. Read the failure carefully and fix `packages/api/src/router/profile.ts` to match the test's assertions — do NOT change the test. Typical failures you might see:

- `rejects.toMatchObject({ code: "CONFLICT" })` fails because the server returned a different error shape. Check the `TRPCError` throw in `setRole`.
- `result.profile` is not `null` for a user with no profile row. Check the `?? null` fallbacks in `getMyProfile`.
- `result.workerJobCategorySlugs` is `undefined` instead of `[]`. Check the empty-array initializer before the `if (workerProfile)` block.

**(C) Test setup crashes with "DATABASE_URL is not set".** Task 1's script change didn't stick. Re-verify `packages/api/package.json` has `"test": "dotenv -e ../../.env -- vitest run"`.

**(D) Test setup crashes with a Postgres connection error.** The Docker Postgres is not running. Start it: `docker compose up -d` from the repo root, confirm with `docker ps | grep findgigs-db`, retry.

- [ ] **Step 3.3: (If needed) Fix any router bugs the tests surfaced**

If step 3.2 hit outcome (B), edit `packages/api/src/router/profile.ts` to match the test expectations, then rerun `pnpm -F @findgigs/api test` until outcome (A) is reached. Do NOT modify the test file — the tests are the spec.

- [ ] **Step 3.4: Commit**

```bash
git add packages/api/src/router/__tests__/profile.test.ts
git add packages/api/src/router/profile.ts  # only if you touched it in step 3.3
git commit -m "test(api): cover profile router setRole + getMyProfile

Five vitest cases against the local Postgres:
- setRole creates a new profile with the given role
- setRole is idempotent when re-called with the same role
- setRole throws CONFLICT when a different role is already set
- getMyProfile returns a null profile for a fresh user
- getMyProfile returns the profile after setRole

Each test uses a unique test-<uuid> user via the createTestUser
helper and cascade-deletes in afterEach. Locks in FIN-8 server
contract before the role-select screen consumes it."
```

---

## Task 4: Create placeholder destination screens

**Files:**

- Create: `apps/mobile/src/app/worker-profile.tsx`
- Create: `apps/mobile/src/app/employer-profile.tsx`

**Why:** The role-select screen's `router.replace()` success case needs two concrete routes to navigate to. Worker Profile (FIN-9) and Employer Profile (FIN-10) ship in later Linear issues, so for FIN-8 we stand up trivial placeholders that express the correct screen identity and include a sign-out button for dev convenience. When FIN-9 ships, it replaces the body of `worker-profile.tsx` without routing churn.

- [ ] **Step 4.1: Create `apps/mobile/src/app/worker-profile.tsx`**

```tsx
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { authClient } from "~/utils/auth";

export default function WorkerProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Text className="text-foreground text-center text-2xl font-bold">
          Worker profile
        </Text>
        <Text className="text-muted-foreground text-center text-base">
          Coming soon (FIN-9)
        </Text>
        <Button
          variant="outline"
          onPress={async () => {
            await authClient.signOut();
            router.replace("/(auth)/signup");
          }}
        >
          <Text>Sign Out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4.2: Create `apps/mobile/src/app/employer-profile.tsx`**

Same shape, different title + issue number:

```tsx
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { authClient } from "~/utils/auth";

export default function EmployerProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Text className="text-foreground text-center text-2xl font-bold">
          Employer profile
        </Text>
        <Text className="text-muted-foreground text-center text-base">
          Coming soon (FIN-10)
        </Text>
        <Button
          variant="outline"
          onPress={async () => {
            await authClient.signOut();
            router.replace("/(auth)/signup");
          }}
        >
          <Text>Sign Out</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4.3: Typecheck**

Run: `pnpm -F @findgigs/mobile typecheck`
Expected: passes. These routes just use primitive components already in the project.

- [ ] **Step 4.4: Commit**

```bash
git add apps/mobile/src/app/worker-profile.tsx apps/mobile/src/app/employer-profile.tsx
git commit -m "feat(mobile): add worker-profile + employer-profile placeholder routes

Placeholders exist so role-select's router.replace success case
has real destinations. Each shows a 'Coming soon' message with
the matching Linear ticket ID (FIN-9 / FIN-10) and a Sign Out
button for dev convenience. FIN-9 and FIN-10 will fill in the
actual form bodies later."
```

---

## Task 5: Replace role-select.tsx with the full role-picker UI

**Files:**

- Modify: `apps/mobile/src/app/role-select.tsx` (full rewrite)

**Why:** The existing file is a stub from commit `38f6d2b` — it shows "How do you want to use FindGigs?" with a "Coming soon" subtitle and a single Sign Out button. We're replacing the body with the real Pencil `EkWQu` design: two selectable role cards, a Continue button, and a `profile.setRole` mutation. The screen's routing options (`headerShown: false`, `gestureEnabled: false`) stay the same.

- [ ] **Step 5.1: Read the current file for context**

Run: `cat apps/mobile/src/app/role-select.tsx`
Expected: the stub described above. Confirm no one else has changed it since the spec was written.

- [ ] **Step 5.2: Replace the file content**

Write `apps/mobile/src/app/role-select.tsx` with exactly this content:

```tsx
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";
import { trpc } from "~/utils/api";

type Role = "worker" | "employer";

interface RoleCardProps {
  role: Role;
  selected: boolean;
  onPress: () => void;
}

function RoleCard({ role, selected, onPress }: RoleCardProps) {
  const title =
    role === "worker" ? "I'm looking for work" : "I'm hiring workers";
  const description =
    role === "worker"
      ? "Find and apply for flexible shifts near you"
      : "Post gigs and find reliable short-term staff";

  return (
    <Pressable onPress={onPress}>
      <View
        className={cn(
          "flex-row gap-3 rounded-2xl border-2 p-5",
          selected ? "border-primary bg-accent" : "border-border bg-card",
        )}
      >
        <View className="bg-accent h-12 w-12 items-center justify-center rounded-full">
          <Text className="text-primary text-xl font-bold">
            {role === "worker" ? "W" : "E"}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-foreground text-base font-semibold">
            {title}
          </Text>
          <Text className="text-muted-foreground text-sm">{description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function RoleSelectScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const setRoleMutation = useMutation(trpc.profile.setRole.mutationOptions());

  const onContinue = () => {
    if (!selectedRole) return;
    setRoleMutation.mutate(
      { role: selectedRole },
      {
        onSuccess: () => {
          router.replace(
            selectedRole === "worker" ? "/worker-profile" : "/employer-profile",
          );
        },
        onError: (error) => {
          Alert.alert("Error", error.message || "Something went wrong");
        },
      },
    );
  };

  const continueDisabled = !selectedRole || setRoleMutation.isPending;
  const continueLabel = setRoleMutation.isPending ? "Saving…" : "Continue";

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <View className="flex-1 gap-7 px-6 pt-10 pb-6">
        <View className="gap-2">
          <Text className="text-foreground text-2xl font-bold">
            How do you want to use FindGigs?
          </Text>
          <Text className="text-muted-foreground text-sm">
            This can't be changed later
          </Text>
        </View>

        <View className="gap-4">
          <RoleCard
            role="worker"
            selected={selectedRole === "worker"}
            onPress={() => setSelectedRole("worker")}
          />
          <RoleCard
            role="employer"
            selected={selectedRole === "employer"}
            onPress={() => setSelectedRole("employer")}
          />
        </View>

        <View className="flex-1" />

        <Button size="lg" disabled={continueDisabled} onPress={onContinue}>
          <Text className="text-primary-foreground font-semibold">
            {continueLabel}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
```

**Implementation notes embedded in the code:**

- **Icons:** The spec mentioned lucide `briefcase` / `building-2`. This plan uses simple "W" / "E" text glyphs inside the circle instead because the project doesn't yet have a wrapped Lucide icon component — importing raw lucide-react-native would need a peer install, and the letter glyphs ship the feature today. Upgrade to real icons as a follow-up when you drop in a `LucideIcon` component.
- **`cn` helper:** the project already has `~/lib/utils.ts` exporting `cn` (imported by the existing `text.tsx` and `button.tsx`). Used here for conditional card styling.
- **Mutation pattern:** `useMutation(trpc.profile.setRole.mutationOptions())` is the tRPC v11 TanStack Query options-proxy pattern. See `apps/mobile/src/app/post/[id].tsx:9` for the query-side precedent.
- **`error.message || "Something went wrong"`:** matches the fallback pattern in `signup.tsx` — using `||` (not `??`) so that an empty-string message also falls through to the default.

- [ ] **Step 5.3: Typecheck**

Run: `pnpm -F @findgigs/mobile typecheck`
Expected: passes.

Common failures:

- `cn is not exported from ~/lib/utils`. The `cn` helper exists — confirm via `cat apps/mobile/src/lib/utils.ts`. If the path is different, adjust the import.
- `Property 'profile' does not exist on type ...`. The tRPC options proxy hasn't picked up the new router. Run `pnpm -F @findgigs/api build` once to regenerate the types, then retry.

- [ ] **Step 5.4: Commit**

```bash
git add apps/mobile/src/app/role-select.tsx
git commit -m "feat(mobile): implement role-select screen (FIN-8)

Two tappable role cards (worker / employer) with selected
state border + accent bg, a Continue button that fires
profile.setRole and router.replaces to the matching
placeholder destination, and Alert.alert error handling
matching the signup.tsx pattern. Header + gesture still
hidden from the existing stub."
```

---

## Task 6: Extend AuthGuard with profile-aware routing

**Files:**

- Modify: `apps/mobile/src/app/_layout.tsx` (extend the `AuthGuard` component)

**Why:** FIN-8's acceptance criterion "User force-closes during role selection → on next open, role selection screen reappears" requires a check that the current `AuthGuard` doesn't make. The guard only checks `session`; it doesn't know the user has `profile.role === null`. We add a single extra rule: **if session exists AND `getMyProfile` has returned AND `profile` is null AND we're not already on `/role-select`, redirect there.** Failing open (no redirect on query error) keeps network flakes from causing phantom redirects.

- [ ] **Step 6.1: Read the current `_layout.tsx`**

Run: `cat apps/mobile/src/app/_layout.tsx`
Expected: the layout from the previous session — AuthGuard with only the session check, font loading, Stack options. This is what you're extending.

- [ ] **Step 6.2: Replace the file content**

Write `apps/mobile/src/app/_layout.tsx` with exactly this content:

```tsx
import { useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";

import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

import "../styles.css";

void SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: profileData, isPending: profilePending } = useQuery({
    ...trpc.profile.getMyProfile.queryOptions(),
    enabled: !!session,
  });
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (sessionPending) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inRoleSelect = segments[0] === "role-select";

    // Rule 1: no session → go to signup
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/signup");
      return;
    }

    // Rule 2: already signed in but visiting auth → kick to home
    if (session && inAuthGroup) {
      router.replace("/");
      return;
    }

    // Rule 3 (FIN-8 minimal gate): session, profile query resolved,
    // no profile row yet → send the user to role selection.
    // Fail-open: if profileData is undefined (query errored or not
    // yet started), we do NOT redirect. This prevents network flakes
    // from bouncing users onto role-select incorrectly.
    if (
      session &&
      !profilePending &&
      profileData &&
      !profileData.profile &&
      !inRoleSelect
    ) {
      router.replace("/role-select");
      return;
    }
  }, [session, sessionPending, profileData, profilePending, segments, router]);

  if (sessionPending) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colorScheme === "dark" ? "#0F172A" : "#FFFFFF",
            },
          }}
        />
      </AuthGuard>
      <StatusBar />
    </QueryClientProvider>
  );
}
```

Diff vs current: added the `useQuery` import, the `trpc` import from `~/utils/api`, the `getMyProfile` query call inside `AuthGuard`, and the rule-3 block in the effect with its new dependencies. Font loading, status bar, and Stack screenOptions are unchanged from the previous session's state.

- [ ] **Step 6.3: Typecheck**

Run: `pnpm -F @findgigs/mobile typecheck`
Expected: passes.

If `trpc.profile` does not exist on the type, `@findgigs/api` hasn't been rebuilt since the profile router was added last round. Run `pnpm -F @findgigs/api build`, then retry.

- [ ] **Step 6.4: Commit**

```bash
git add apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): gate routing on profile.role in AuthGuard (FIN-8)

Adds a third rule to the auth guard: if the user has a session
but no profile row yet, redirect them to /role-select. Satisfies
the FIN-8 force-close acceptance criterion — any app relaunch
during interrupted onboarding now lands back on role selection.

Query fails open: if getMyProfile errors on boot, no redirect
fires so network flakes don't cause phantom role-select bounces."
```

---

## Task 7: Full-repo sanity check

**Files:** none

**Why:** We've touched api, mobile, and the vitest script. Run the whole suite end-to-end to make sure no package has drifted and the pieces actually compose.

- [ ] **Step 7.1: Repo-wide typecheck**

Run: `pnpm typecheck`
Expected: "13 successful, 13 total" (matches last round's baseline). No errors in any package.

- [ ] **Step 7.2: Repo-wide tests**

Run: `pnpm test`
Expected: smoke test + 5 profile tests pass. Mobile jest also runs — expect its existing trivial setup test to pass (`1 + 1 === 2`).

If `pnpm test` at the root fails on `@findgigs/api` because DATABASE_URL isn't propagated through turbo, that's a separate follow-up — running `pnpm -F @findgigs/api test` directly will still work since the script loads dotenv itself. Document the turbo env gap in a Linear ticket and move on.

- [ ] **Step 7.3: (Optional) Verify on the mobile simulator**

If a simulator is available: run `pnpm -F @findgigs/mobile dev`, open the app in Expo Go on the simulator (or the dev client if you built one), sign up a fresh account, and verify:

1. Signup → lands on the new role-select screen (not the stub)
2. Tapping a card shows the selected state (blue border + accent bg)
3. Continue disabled until you pick one
4. Tapping Continue routes to `/worker-profile` or `/employer-profile` placeholder
5. Force-quit the app mid-role-select, reopen → lands back on role-select

Manual, no commit.

- [ ] **Step 7.4: (Optional) Mark FIN-8 done in Linear**

If everything above passes, move FIN-8 from Backlog → In Progress → Done in Linear. Link the commits.

No Task 7 commit — if anything needed a fix, it would have been committed inside the fixing task.

---

## Self-Review

1. **Spec coverage:** Every spec §2–§14 item is represented in a task above. §10 (tests) → Tasks 1+2+3. §7 (screen UI) → Task 5. §8 (AuthGuard) → Task 6. §9 (placeholders) → Task 4. §13 (acceptance criteria) → covered across 3/4/5/6. ✅
2. **Placeholder scan:** No `TBD` / `TODO` / "implement later" / "add appropriate error handling" anywhere above. Every code block is complete and executable. ✅
3. **Type consistency:** `selectedRole` type is `"worker" | "employer" | null` in Task 5; matches the `Role = "worker" | "employer"` alias. The test file uses `"worker"` and `"employer"` as literals, consistent with `RoleEnum` in `packages/validators/src/profile.ts`. Mutation uses `{ role: selectedRole }`, input shape matches `SetRoleSchema`. ✅
4. **Known spec drift noted:** spec uses `useMutation()` / `useQuery()` directly on `trpc.x.y`, but project actually uses `useMutation(trpc.x.y.mutationOptions())` via the tRPC v11 options proxy. Flagged at the top of this plan and the plan uses the correct pattern throughout. ✅

No fixes needed — plan is self-consistent.

---
