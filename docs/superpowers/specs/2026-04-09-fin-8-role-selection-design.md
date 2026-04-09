# FIN-8 Role Selection — Design Spec

**Date:** 2026-04-09
**Linear issue:** FIN-8 — Role Selection (Worker / Employer)
**Parent epic:** FIN-5 — Sprint 1: Foundation — Auth, Role Routing & Onboarding
**Status:** Awaiting review
**Author:** Ding Ruoqian (CTO) + Claude

---

## 1. Goal

Deliver a one-screen flow where a freshly-signed-up user picks whether they are a Worker or an Employer, persists that choice to the `profile` table, and is routed to the matching onboarding step (placeholder routes for this slice; FIN-9 and FIN-10 fill them in later).

The screen must also self-recover: if a user force-closes the app mid-selection, the next launch puts them back on role-select until they actually make a choice.

## 2. Scope

**In scope (FIN-8 only):**

- One new screen body: `apps/mobile/src/app/role-select.tsx` (replacing the current placeholder from commit `38f6d2b`).
- Two trivial placeholder screens at `/worker-profile` and `/employer-profile` so the success-case `router.replace()` has real targets.
- A minimal extension to the global `AuthGuard` in `_layout.tsx` that detects "logged-in but no profile row yet" and redirects to `/role-select`.
- Full vitest coverage of the `profile.setRole` and `profile.getMyProfile` tRPC procedures, written **test-first** per the TDD decision.
- Environment wiring so vitest can reach the local `findgigs` Postgres.

**Explicitly out of scope (deferred to later Linear issues):**

- Worker profile form and job-category chips (FIN-9).
- Employer profile form (FIN-10).
- Venue creation (FIN-11).
- The full role-based routing gate (FIN-12) — we only add the minimum gate needed to satisfy FIN-8's force-close acceptance criterion.
- Any mobile UI tests (jest-expo / react-native-testing-library). Screen will be eyeballed on the simulator.
- Image storage (profile photos, logos) — not relevant to this slice.

## 3. Decisions Made During Brainstorm

| #   | Decision                  | Chosen                                                                                                    |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Spec scope                | FIN-8 only (single screen, single mutation)                                                               |
| 2   | Test layers               | API only (vitest on `profile.setRole` + `getMyProfile`)                                                   |
| 3   | Test DB strategy          | Real local Docker Postgres, isolate by unique `test-<uuid>` userId, cascade-delete cleanup in `afterEach` |
| 4   | Post-mutation destination | Create placeholder routes `/worker-profile` and `/employer-profile`                                       |
| 5   | Force-close handling      | Extend global `AuthGuard` in `_layout.tsx` with a minimal `getMyProfile` check                            |
| 6   | TDD discipline            | Strict TDD — write all 5 failing tests first, then implement                                              |
| 7   | Initial card state        | Neither card pre-selected. User must explicitly pick before Continue enables                              |
| 8   | Error UX                  | `Alert.alert("Error", error.message ?? "Something went wrong")` — matches existing `signup.tsx` pattern   |
| 9   | Loading state             | Continue button `disabled` while `isPending`, label changes to `"Saving…"`                                |
| 10  | Back gesture              | Disabled on `role-select` (already set on the stub)                                                       |
| 11  | Card icons                | lucide `briefcase` for worker, lucide `building-2` for employer                                           |

## 4. Architecture

Three independently testable pieces:

1. **`profile` tRPC router** (already scaffolded in last round). TDD here means writing the tests _now_, running them against the existing implementation, and letting them either confirm correct behavior or surface bugs. Tests live at `packages/api/src/router/__tests__/profile.test.ts` and use a small helper at `packages/api/src/__tests__/helpers.ts`.

2. **Role-select screen** at `apps/mobile/src/app/role-select.tsx`. Pure UI driven by a single `selectedRole: "worker" | "employer" | null` useState hook and a `trpc.profile.setRole.useMutation`. On success, `router.replace()` to the matching placeholder screen.

3. **AuthGuard amendment** in `apps/mobile/src/app/_layout.tsx`. After the existing session check, call `trpc.profile.getMyProfile.useQuery()` and redirect to `/role-select` if `session && !data?.profile && !inRoleSelect`. Fails open on query error (no redirect when data is unavailable).

## 5. Files Touched

### Created (4 files)

| Path                                                | Purpose                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/api/src/router/__tests__/profile.test.ts` | The 5 vitest tests driving the TDD loop                                    |
| `packages/api/src/__tests__/helpers.ts`             | `createTestUser()` / `cleanupTestUser()` shared across future router tests |
| `apps/mobile/src/app/worker-profile.tsx`            | Placeholder destination with title + "Coming soon" + sign-out button       |
| `apps/mobile/src/app/employer-profile.tsx`          | Same as above, different title                                             |

### Modified (4 files)

| Path                                  | Change                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `apps/mobile/src/app/role-select.tsx` | Replace stub body with full UI (two cards + Continue + mutation)        |
| `apps/mobile/src/app/_layout.tsx`     | Add `getMyProfile` check to `AuthGuard` with redirect to `/role-select` |
| `packages/api/package.json`           | `test` script becomes `dotenv -e ../../.env -- vitest run`              |
| `packages/api/src/router/profile.ts`  | Only if tests surface bugs. Not a planned change.                       |

### Not touched

- `packages/db/src/schema.ts` — `profile` table with `role` + `onboardingComplete` is already final.
- `packages/validators/src/*` — `SetRoleSchema` already exists.
- `packages/api/src/root.ts` — `profileRouter` is already wired.
- `apps/mobile/src/app/(auth)/*` — `signup.tsx` already calls `router.replace("/role-select")`.
- `apps/mobile/src/app/index.tsx` — still the theme-test content from a previous session. Out of scope for FIN-8.

## 6. Data Flow

### Happy path (fresh signup)

```
signup.tsx → authClient.signUp.email() → router.replace("/role-select")
  → role-select.tsx mounts
      AuthGuard: session ✓, getMyProfile returns profile=null → allow /role-select
  → user taps worker card → selectedRole = "worker"
  → user taps Continue → button disables, label → "Saving…"
      → profile.setRole({ role: "worker" })
          INSERT INTO profile (user_id, role) VALUES (..., 'worker')
      → returns { id, userId, role: "worker", onboardingComplete: false, ... }
  → onSuccess: router.replace("/worker-profile")
  → worker-profile.tsx mounts (placeholder)
```

### Force-close path (acceptance criterion coverage)

```
signup → role-select mounts → user kills app before tapping Continue
→ user reopens app
  → _layout.tsx AuthGuard runs
      session ✓ (persisted in SecureStore)
      getMyProfile → data.profile === null
      guard: session && !profile && !inRoleSelect → router.replace("/role-select")
  → role-select.tsx mounts fresh (no selection)
  → user picks, taps Continue, normal happy path resumes
```

### Returning user (role already set, relaunching)

```
app opens → AuthGuard
  session ✓, getMyProfile → data.profile.role === "worker"
  guard: profile exists, no role-select redirect
→ user lands on / (home is currently a stub — FIN-12 will route correctly)
```

## 7. Role-Select Screen UI Detail

Matches the Pencil `EkWQu` frame. All colors from theme tokens; no hardcoded hex.

```tsx
<SafeAreaView className="bg-background flex-1">
  <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
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

    <Button
      size="lg"
      disabled={!selectedRole || setRoleMutation.isPending}
      onPress={onContinue}
    >
      <Text className="text-primary-foreground font-semibold">
        {setRoleMutation.isPending ? "Saving…" : "Continue"}
      </Text>
    </Button>
  </View>
</SafeAreaView>
```

### RoleCard (inline component)

```tsx
function RoleCard({ role, selected, onPress }: Props) {
  const title =
    role === "worker" ? "I'm looking for work" : "I'm hiring workers";
  const description =
    role === "worker"
      ? "Find and apply for flexible shifts near you"
      : "Post gigs and find reliable short-term staff";
  const iconName = role === "worker" ? "briefcase" : "building-2";

  return (
    <Pressable onPress={onPress}>
      <View
        className={cn(
          "flex-row gap-3 rounded-2xl border-2 p-5",
          selected ? "border-primary bg-accent" : "border-border bg-card",
        )}
      >
        <View className="bg-accent h-12 w-12 items-center justify-center rounded-full">
          <LucideIcon name={iconName} size={24} />
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
```

Inline (not its own file) because it has exactly two uses and no reuse elsewhere.

### Continue handler

```tsx
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
        Alert.alert("Error", error.message ?? "Something went wrong");
      },
    },
  );
};
```

## 8. AuthGuard Amendment

```tsx
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: profileData, isPending: profilePending } =
    trpc.profile.getMyProfile.useQuery(undefined, {
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

    // Rule 3 (FIN-8 minimal gate): session but no profile → role-select
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
```

Note the fail-open: rule 3 requires `profileData` to exist — if the query errors, `profileData` is `undefined` and no redirect fires, so a network flake on app start doesn't incorrectly send users to role-select.

## 9. Placeholder Screens

Both follow the same shape:

```tsx
// apps/mobile/src/app/worker-profile.tsx
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
        <Text className="text-foreground text-2xl font-bold">
          Worker profile
        </Text>
        <Text className="text-muted-foreground">Coming soon (FIN-9)</Text>
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

`employer-profile.tsx` is identical with `"Worker profile"` → `"Employer profile"` and `FIN-9` → `FIN-10`.

## 10. Testing Strategy

### Test file: `packages/api/src/router/__tests__/profile.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupTestUser, createTestUser } from "../../__tests__/helpers";

describe("profile router", () => {
  let testUserId: string;
  let caller: Awaited<ReturnType<typeof createTestUser>>["caller"];

  beforeEach(async () => {
    ({ userId: testUserId, caller } = await createTestUser());
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
    });

    it("is idempotent when called twice with the same role", async () => {
      const first = await caller.profile.setRole({ role: "employer" });
      const second = await caller.profile.setRole({ role: "employer" });
      expect(second.id).toBe(first.id);
      expect(second.role).toBe("employer");
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

### Helper: `packages/api/src/__tests__/helpers.ts`

```ts
import { randomUUID } from "node:crypto";

import { eq } from "@findgigs/db";
import { db } from "@findgigs/db/client";
import { user } from "@findgigs/db/schema";

import { appRouter } from "../root";

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

  const caller = appRouter.createCaller({
    db,
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
    } as never, // Minimal Better Auth Session shape
    authApi: {} as never, // unused by profile router
  });

  return { userId, caller };
}

export async function cleanupTestUser(userId: string) {
  await db.delete(user).where(eq(user.id, userId));
}
```

### Environment wiring

Update `packages/api/package.json`:

```json
{
  "scripts": {
    "test": "dotenv -e ../../.env -- vitest run"
  },
  "devDependencies": {
    "dotenv-cli": "^10.0.0"
  }
}
```

Loads `DATABASE_URL` from the root `.env` at test time — same pattern as `@findgigs/db`'s `with-env`.

### Coverage rationale

The 5 tests cover every behavior FIN-8's UI actually exercises:

| Test                   | UI flow it protects                                                 |
| ---------------------- | ------------------------------------------------------------------- |
| setRole creates        | User taps Continue for the first time after signup                  |
| setRole idempotent     | Button somehow tapped twice, or same-role retry after network flake |
| setRole CONFLICT       | Server-side enforcement of "role is locked" acceptance criterion    |
| getMyProfile null      | AuthGuard sees fresh user → redirects to role-select                |
| getMyProfile populated | AuthGuard sees onboarded user → allows normal routing               |

Deeper `getMyProfile` coverage (populated worker profile with job categories, populated employer profile with venues) is deferred to FIN-9/10/11 where the write paths for those tables exist.

### Test isolation guarantee

Each test gets its own unique `test-<uuid>` user. Cascade-delete in `afterEach` removes the user and all dependent rows (`profile`, `worker_profile`, `employer_profile`, `worker_job_category`, `venue`). Safety net: a crashed test leaves a stray user, but a later `DELETE FROM "user" WHERE id LIKE 'test-%'` sweep clears them manually. No risk of cross-test interference because UUIDs don't collide.

## 11. TDD Loop

1. **Create the helper file** (`helpers.ts`). Not itself a test, but the test file imports it. Smoke-check it compiles.
2. **Create the test file** with all 5 tests as written above. Run `pnpm -F @findgigs/api test`. Expected outcome: tests run against the existing implementation from last round. Either they all pass (implementation is correct, tests lock in behavior) or some fail (real bugs surfaced — fix and rerun).
3. **Commit the tests + any router bugfixes.**
4. **Build the placeholder screens** (`worker-profile.tsx`, `employer-profile.tsx`). Untested, eyeballed.
5. **Rewrite the role-select screen body.** Untested, eyeballed on simulator or web.
6. **Amend the AuthGuard** in `_layout.tsx`. Untested, verified by force-closing the app mid-flow on the simulator.
7. **Commit the screen + guard changes.**
8. **Mark FIN-8 Done** in Linear.

The "existing implementation" caveat on step 2 is worth naming: because `profile.setRole` and `getMyProfile` were written in the previous session without tests, strict-TDD purists would call this "characterization testing" rather than TDD. For this feature we accept it — the tests codify current behavior and catch future regressions either way, and FIN-9 onwards will be true red-then-green TDD because those routers don't yet exist.

## 12. Error Handling

### `setRole` mutation errors

Single catch-all `Alert.alert("Error", error.message ?? "Something went wrong")`, matching `signup.tsx`. Handles network failures, `CONFLICT`, `UNAUTHORIZED`, and generic 5xx uniformly. Specific server messages (e.g., "Role is locked and cannot be changed.") surface verbatim through `error.message`.

### `getMyProfile` query errors

**Fail-open in the AuthGuard.** The redirect-to-role-select rule only fires when the query has successfully returned and `profileData.profile === null`. If the query is pending or errored, no redirect happens. Worst case: a network flake on app start leaves the user on their current screen until the query succeeds on retry (React Query does 3 auto-retries by default).

### Double-tap / race

Prevented by `disabled={!selectedRole || setRoleMutation.isPending}` on the Continue button. Second tap is a no-op because the button is disabled instantly after the first tap. Defensive `if (!selectedRole) return` inside `onContinue` is a second layer.

### Validation

Not applicable. The client only ever sends `"worker"` or `"employer"` (the only two card values), both of which pass `SetRoleSchema` by construction. No client-side Zod needed.

## 13. Acceptance Criteria Coverage

From FIN-8:

| Criterion                                            | Covered by                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Two clear, tappable options                          | Two RoleCards in `role-select.tsx`                                                    |
| Selection saves to `profile.role`                    | `setRole` mutation, tested by "creates a new profile"                                 |
| Worker → worker profile creation                     | `router.replace("/worker-profile")` on success                                        |
| Employer → employer profile creation                 | `router.replace("/employer-profile")` on success                                      |
| Screen only appears once after signup                | AuthGuard redirects only when `profile === null`                                      |
| Role is immutable for MVP                            | `setRole` throws `CONFLICT` on different role, tested                                 |
| Single tap to select, then confirm (no auto-advance) | Two-tap flow: card tap sets state, Continue fires mutation                            |
| Force-close → reappears on next open                 | AuthGuard rule 3 redirects to role-select when profile is null                        |
| Dual-role not supported                              | `roleEnum = pgEnum("role", ["worker", "employer"])` — no third option, enforced by DB |

## 14. Out-of-Scope Reminders

When FIN-8 is done, the following still don't exist:

- The full FIN-12 routing gate (worker onboarding state, venue state, onboarding-complete home routing).
- Actual worker / employer profile forms (FIN-9 / FIN-10).
- Venue creation (FIN-11).
- Mobile tests (jest-expo + react-native-testing-library).
- Any CI job that runs the new vitest suite (PR gate currently runs typecheck + lint + build + test, but `test` was `passWithNoTests` before this spec. After this spec it will run for real — may need to add a Postgres service container to the CI workflow, which is itself a follow-up).

The last point is a known follow-up for CI. Not blocking for shipping FIN-8 locally, but we should create a Linear ticket for it separately.

---

**End of spec.**
