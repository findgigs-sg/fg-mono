# FIN-9 Worker Profile Creation — Design Spec

**Linear:** [FIN-9 Worker Profile Creation](https://linear.app/findgigs/issue/FIN-9/worker-profile-creation)
**Branch (Linear gitBranchName):** `bubuding0809/fin-9-worker-profile-creation`
**Parent:** FIN-5 (Onboarding)
**Author:** Claude (brainstormed 2026-04-10 with @bubuding0809)

---

## Goal

A worker who has just selected `role=worker` lands on a single scrollable form, fills in name / phone / at least one job category (+ optional bio + optional photo), taps **Complete Profile**, and lands on the home placeholder with `profile.onboarding_complete = true`.

## Non-goals (explicitly out of FIN-9 scope)

- Editing an existing worker profile from settings — follow-up ticket (FIN-12 or later)
- Photo deletion when a user deletes their account — needs a separate cascade-delete ticket
- Background orphan cleanup cron for abandoned avatar uploads — post-MVP follow-up
- Employer profile creation (FIN-10) and venue creation (FIN-11) — separate tickets
- Draft saving / form persistence across sessions — ticket explicitly excludes it
- Phone verification / OTP — "stored, not verified for MVP"
- Private bucket + signed read URLs for avatars — bucket is public for MVP
- Mobile component tests / E2E — no infrastructure, not in scope for FIN-9
- Native dev build rebuild — `expo-image-picker` + `expo-image-manipulator` are Expo-managed, no rebuild required

---

## Architecture Overview

### 11 locked decisions

1. **Form library** = TanStack React Form (matches existing `signup.tsx` / `login.tsx`)
2. **Photo storage** = full upload to **public** Supabase Storage bucket `avatars`
3. **Upload auth** = presigned URL via tRPC (new `storage.getAvatarUploadUrl`), service-role key server-side; no Supabase client on mobile
4. **Upload path** = deterministic `avatars/{userId}.jpg` — every upload overwrites the previous one, bounding orphans at ≤1 per abandoned user
5. **Image pipeline** = `expo-image-picker` (camera + gallery) → `expo-image-manipulator` (JPEG re-encode, 800px resize, 0.8 quality) → bare `fetch` PUT to signed URL
6. **Upload timing** = on pick, with spinner overlay on avatar; submit button is disabled while upload is in-flight
7. **Job category seeding** = new `pnpm db:seed` script with `ON CONFLICT DO UPDATE`, wired as a new step in the CI `test` job
8. **AuthGuard rule 4** = if `profile.role === "worker" && !profile.onboardingComplete && !inWorkerProfile` → `router.replace("/worker-profile")`; once `onboardingComplete === true`, existing rules fall through to `/`
9. **Tests** = vitest on `profile.completeWorkerProfile` (extended) + `storage.getAvatarUploadUrl` (new); router layer only, no mobile component tests
10. **Home destination** = current `apps/mobile/src/app/index.tsx` (unchanged)
11. **Rollout** = single PR, full scope

### Data flow

```
[Worker on /role-select] → setRole(worker)
       ↓ AuthGuard rule 4
[/worker-profile]
       │
       ├─ pick photo (camera OR gallery)
       │         ↓
       │   expo-image-manipulator (JPEG, 800px, q=0.8)
       │         ↓
       │   getAvatarUploadUrl()  ←  new tRPC mutation (storage router)
       │         ↓
       │   PUT blob → signed Supabase URL  →  avatars/{userId}.jpg
       │         ↓
       │   form.setFieldValue('photoUrl', publicUrl)
       │
       └─ fill fullName / phone / bio / categories
             ↓
       tap Complete Profile (disabled while upload in-flight)
             ↓
       completeWorkerProfile({ fullName, phone, bio?, photoUrl?, jobCategories[] })
             ↓
       Tx: upsert WorkerProfile → replace WorkerJobCategory rows → set onboarding_complete = true
             ↓
       invalidate getMyProfile → router.replace('/')
             ↓ AuthGuard fall-through (rule 4 no longer fires)
       [index.tsx — home placeholder]
```

### New packages

- `expo-image-picker` (Expo SDK 55 compatible)
- `expo-image-manipulator` (Expo SDK 55 compatible)
- `@supabase/supabase-js` (server-only, added to `packages/api`)

### Files touched

**Created:**

- `packages/db/src/seed.ts`
- `packages/api/src/router/storage.ts`
- `packages/api/src/router/__tests__/storage.test.ts`
- `docs/superpowers/specs/2026-04-10-fin-9-worker-profile-design.md` (this file)

**Modified:**

- `packages/db/package.json` — new `seed` script
- `package.json` (root) — new `db:seed` script
- `packages/api/env.ts` — new Supabase env vars
- `packages/api/src/root.ts` — register storage router
- `packages/api/src/router/__tests__/profile.test.ts` — extend with `completeWorkerProfile` tests
- `.env.example` — Supabase env vars
- `.github/workflows/pr-gate.yml` — seed step in `test` job
- `apps/mobile/package.json` — new dependencies
- `apps/mobile/app.json` — `expo-image-picker` plugin with iOS permission strings
- `apps/mobile/src/app/_layout.tsx` — AuthGuard rule 4
- `apps/mobile/src/app/worker-profile.tsx` — full rewrite from placeholder
- `README.md` — "One-time Supabase Storage setup" subsection

---

## Backend

### Job category seed

New file `packages/db/src/seed.ts`:

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Rationale for `ON CONFLICT DO UPDATE`:** lets the seed be re-run freely whenever `JOB_CATEGORIES` changes (rename a label, reorder). Slug is the stable primary key for upsert. This means changing `JOB_CATEGORIES` in `@findgigs/validators` + re-running `pnpm db:seed` converges the DB to the new state with zero manual intervention.

**Package dependency edge:** `packages/db` now depends on `packages/validators`. `validators` has no dependencies of its own, so this is a safe one-way edge. Added to `packages/db/package.json` dependencies.

**Scripts:**

- `packages/db/package.json`: `"seed": "tsx src/seed.ts"`
- Root `package.json`: `"db:seed": "pnpm -F @findgigs/db seed"`

**CI wiring** in `.github/workflows/pr-gate.yml`, inside the existing `test` job, after `Push DB schema`:

```yaml
- name: Seed DB
  run: pnpm db:seed
```

### Environment variables

Three new **server-only** variables, added to `packages/api/env.ts`:

```ts
SUPABASE_URL: z.url(),
SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
SUPABASE_AVATAR_BUCKET: z.string().default("avatars"),
```

And to `.env.example` (with placeholder/empty values — real values supplied by the user locally and by GitHub Actions secrets in CI).

**These are NOT exposed to the client bundle.** They live in `packages/api/env.ts`, not `apps/web/src/env.ts`. The mobile app never sees these values — it only receives the derived `publicUrl` returned from the tRPC procedure.

### Storage router

New file `packages/api/src/router/storage.ts`:

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { createClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";

import { env } from "../../env";
import { protectedProcedure } from "../trpc";

// Lazy client construction — createClient is called at first use, not at
// module import. When `@supabase/supabase-js` is mocked at the vitest
// level, the mock is what gets called here, so tests never hit real
// Supabase. (Note: the `env` import at the top of this file still runs
// its Zod validation at module load; CI gets dummy-but-valid values
// from `.env.example` — see the Testing section.)
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
  }
  return supabaseClient;
}

export const storageRouter = {
  /**
   * Returns a short-lived signed upload URL for the current user's avatar.
   * Path is deterministic — `avatars/{userId}.jpg` — so every upload
   * overwrites the previous one. The public URL is assembled server-side
   * from the same path and returned to the client, which then passes it
   * to profile.completeWorkerProfile after the PUT completes.
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
        message: `Failed to create upload URL: ${error?.message ?? "unknown"}`,
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

Registered in `packages/api/src/root.ts` alongside the existing routers.

**Key design notes:**

- `upsert: true` is critical — without it, the second call for the same user returns `"The resource already exists"` instead of a fresh signed URL.
- It's a `mutation`, not a `query`: `createSignedUploadUrl` is a side-effectful server op that should never be cached by React Query.
- The error path returns a specific message (`error?.message`) so misconfiguration (bucket missing, wrong service key) surfaces immediately during smoke testing rather than hiding behind a generic 500.
- `auth: { persistSession: false }` disables Supabase's own session handling — we use Better Auth, not Supabase Auth.

### `profile.completeWorkerProfile`

**Already exists** in `packages/api/src/router/profile.ts` and the current implementation looks correct:

- Upserts `WorkerProfile` (update if exists, insert if not)
- Deletes all existing `WorkerJobCategory` rows for the user
- Inserts the new `WorkerJobCategory` rows by looking up slugs against `JobCategory` with `inArray`
- Sets `profile.onboardingComplete = true`
- All inside a transaction

**What FIN-9 changes:** nothing in the router itself. We add tests (section below) that actually exercise the procedure end-to-end and assert the behavior. If the tests surface a bug in the existing implementation, we fix the router in the same PR.

---

## Mobile

### AuthGuard rule 4

`apps/mobile/src/app/_layout.tsx`:

```ts
const ROLE_SELECT_SEGMENT = "role-select";
const WORKER_PROFILE_SEGMENT = "worker-profile";

// inside AuthGuard's useEffect:
const inRoleSelect = segments[0] === ROLE_SELECT_SEGMENT;
const inWorkerProfile = segments[0] === WORKER_PROFILE_SEGMENT;

// … existing rules 1–3 unchanged …

// Rule 4 (FIN-9): worker role set but onboarding not yet complete
// → send to the worker profile creation form. Same fail-open stance as
// rule 3 (only redirect when profileData has resolved).
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

Rule 3 and rule 4 are disjoint (rule 3 fires on `!profileData.profile`, rule 4 fires on a present-but-incomplete worker profile), so they don't race. Once `onboardingComplete` flips to `true` on mutation success, rule 4 stops firing and the guard falls through to the root home — no separate rule needed to push the worker off `/worker-profile`.

The matching employer rule will land in FIN-10/11.

### `worker-profile.tsx` — file structure

Single screen file, full rewrite from the current placeholder. ~250–300 lines. Three internal function components defined in the same file: `PhotoPicker`, `LabeledField`, `CategoryChips`. Extract if any of them exceeds ~80 lines during implementation.

**JSX composition:**

```tsx
<SafeAreaView className="bg-background flex-1">
  <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
  <KeyboardAvoidingView behavior="padding" className="flex-1">
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      className="flex-1"
    >
      <Header />{" "}
      {/* "Set up your profile" / "Help employers get to know you" */}
      <PhotoPicker form={form} onStatusChange={setPhotoStatus} />
      <LabeledField form={form} name="fullName" label="Full Name" />
      <LabeledField
        form={form}
        name="phone"
        label="Phone Number"
        keyboardType="phone-pad"
      />
      <LabeledField
        form={form}
        name="bio"
        label="Short Bio (Optional)"
        multiline
        maxLength={300}
        counter
      />
      <CategoryChips form={form} />
      <CompleteProfileButton
        form={form}
        isUploading={photoStatus === "uploading"}
      />
    </ScrollView>
  </KeyboardAvoidingView>
</SafeAreaView>
```

### TanStack React Form wiring

```ts
const [photoStatus, setPhotoStatus] = useState<PhotoStatus>("idle");
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
    jobCategories: [] as JobCategorySlug[],
  },
  validators: {
    onChange: WorkerProfileSchema,
  },
  onSubmit: ({ value }) => {
    completeWorkerProfileMutation.mutate({
      fullName: value.fullName,
      phone: value.phone,
      bio: value.bio?.trim() ? value.bio : undefined,
      photoUrl: value.photoUrl,
      jobCategories: value.jobCategories,
    });
  },
});
```

**Key wiring:**

- `validators: { onChange: WorkerProfileSchema }` — reuses the existing Zod schema from `@findgigs/validators`, no duplication
- Each `<form.Field>` reads its error from `field.state.meta.errors`
- `onSubmit` doesn't await the upload — the submit button is visibly disabled while `photoStatus === "uploading"`, so `onSubmit` only ever fires when the upload is either finished, failed, or never started
- Same `invalidate-then-replace` pattern as FIN-8's role-select screen (prevents AuthGuard race)

### `CategoryChips`

```tsx
function CategoryChips({ form }: { form: FormApi<...> }) {
  return (
    <form.Field name="jobCategories">
      {(field) => {
        const selected = new Set(field.state.value);
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
                      field.handleChange(Array.from(next));
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
            {field.state.meta.errors.length > 0 && (
              <Text className="text-destructive text-xs">
                Select at least one job category
              </Text>
            )}
          </View>
        );
      }}
    </form.Field>
  );
}
```

- Source of truth is `JOB_CATEGORIES` from `@findgigs/validators` — same constant the seed script uses
- `flex-row flex-wrap gap-2` — chips wrap naturally at content width, matching the Pencil frame's irregular row layout

### `PhotoPicker` — state machine

Four states, tracked by a single `status` variable + a `localUri`:

| Status      | `localUri`     | `form.photoUrl`        | Avatar shows                                                         | Submit button |
| ----------- | -------------- | ---------------------- | -------------------------------------------------------------------- | ------------- |
| `idle`      | `null`         | `undefined`            | placeholder + camera icon + "Add a photo to improve your chances"    | enabled       |
| `uploading` | local file URI | `undefined`            | local preview + spinner overlay                                      | **disabled**  |
| `success`   | local file URI | public URL from server | local preview (clean)                                                | enabled       |
| `error`     | local file URI | `undefined`            | local preview + red retry overlay + "Upload failed — Retry / Remove" | enabled       |

**Invariant:** `form.photoUrl` is set _only_ in the `success` state. Any other state means the server has no photo for this user.

**Error state actions:**

- **Retry** — re-opens the ActionSheet (same entry as idle tap)
- **Remove** — clears `localUri`, resets status to `idle`, clears `form.photoUrl`

The "Remove" action is critical — without it, a user whose upload failed would see their local preview on the avatar but the server would silently save no photo on submit.

### `PhotoPicker` — camera + gallery ActionSheet

Tapping the avatar in `idle` / `success` / `error` states opens an ActionSheet with three options:

- **Take photo** → `pickFromCamera()`
- **Choose from library** → `pickFromLibrary()`
- **Cancel**

Implementation: use `ActionSheetIOS.showActionSheetWithOptions` on iOS; on Android, fall back to a plain `Alert.alert` with three buttons (the cross-platform minimum — React Native doesn't ship a first-party ActionSheet for Android, and adding a third-party lib for a single usage is not justified). A thin wrapper:

```ts
function showPhotoActionSheet(opts: {
  onCamera: () => void;
  onLibrary: () => void;
}) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Take Photo", "Choose from Library", "Cancel"],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) opts.onCamera();
        if (index === 1) opts.onLibrary();
      },
    );
  } else {
    Alert.alert("Add Profile Photo", undefined, [
      { text: "Take Photo", onPress: opts.onCamera },
      { text: "Choose from Library", onPress: opts.onLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  }
}
```

**Camera and library handlers:**

```ts
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
  setLocalUri(uri);
  setStatus("uploading");

  try {
    // 1. Re-encode JPEG + resize to 800px
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.8, format: SaveFormat.JPEG },
    );

    // 2. Request signed upload URL
    const { uploadUrl, publicUrl } =
      await getAvatarUploadUrlMutation.mutateAsync();

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
    form.setFieldValue("photoUrl", publicUrl);
    setStatus("success");
  } catch (err) {
    console.warn("[worker-profile] photo upload failed:", err);
    form.setFieldValue("photoUrl", undefined);
    setStatus("error");
  }
};
```

**Why bare `fetch` + blob instead of `supabase-js` on the client:** `supabase-js` on React Native requires wiring `AsyncStorage` + URL polyfills and pulls its own auth model into the bundle. A bare `fetch` PUT to the signed URL is the same mechanism supabase-js uses under the hood, and it's ~4 lines here. Keeps the mobile bundle lean and avoids dragging in a second auth framework.

### Expo config — iOS permission strings

`apps/mobile/app.json` gets an `expo-image-picker` plugin entry with usage descriptions:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "FindGigs needs access to your photos so you can upload a profile picture.",
          "cameraPermission": "FindGigs needs access to your camera so you can take a profile picture."
        }
      ]
    ]
  }
}
```

**Required** — without these usage strings, iOS rejects the permission request at runtime and the picker fails silently. Adding this to the plan as an explicit task.

### Submit button

```tsx
<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
  {([canSubmit, isSubmitting]) => (
    <Button
      size="lg"
      disabled={
        !canSubmit ||
        isSubmitting ||
        isUploading ||
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
```

`form.Subscribe` ensures the button reactively re-renders when `canSubmit` flips. `isUploading` comes from the screen-level `photoStatus` state. The button is disabled whenever any of these are true: form invalid, form submitting, photo uploading, or mutation pending.

---

## Testing

### Surface

- **`packages/api/src/router/__tests__/profile.test.ts`** — extend with `describe("completeWorkerProfile")` block (vitest, real Postgres, same harness as FIN-8)
- **`packages/api/src/router/__tests__/storage.test.ts`** — new file with mocked Supabase client
- **No dedicated seed test** — the CI `Seed DB` step failing _is_ the test; additionally, the happy-path `completeWorkerProfile` test asserts `workerJobCategorySlugs.length > 0` which implicitly verifies the seed populated the table
- **No mobile component tests** — consistent with FIN-8

### CI env-var strategy for the storage router

The storage router imports `env` from `packages/api/env.ts`, and the env file runs Zod validation **at module load time**. This means simply mocking `@supabase/supabase-js` is not enough — if `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset when vitest imports the router (transitively through `appRouter.createCaller`), the test suite crashes before any test runs.

**Solution:** ship dummy-but-schema-valid values in `.env.example` so that the existing CI step `cp .env.example .env` gives the env validator something it accepts:

```dotenv
# .env.example additions
SUPABASE_URL="https://placeholder.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="placeholder-service-role-key-do-not-use-in-prod"
SUPABASE_AVATAR_BUCKET="avatars"
```

These values pass `z.url()` and `z.string().min(1)` validation but never reach real Supabase because `@supabase/supabase-js` is mocked at the vitest level. Production reads the real values from Vercel env vars, not `.env.example`. Local dev reads from `.env` which the developer fills in with their own Supabase project values.

### `completeWorkerProfile` test cases (8 tests)

1. **Happy path — minimum required fields**
   - Arrange: create test user, `setRole("worker")`
   - Act: `completeWorkerProfile({ fullName: "Jane Doe", phone: "+6512345678", jobCategories: ["food-and-beverage", "events"] })`
   - Assert: returns `{ success: true }`; `getMyProfile()` returns `workerProfile.fullName === "Jane Doe"`, `workerProfile.phone === "+6512345678"`, `workerProfile.bio === null`, `workerProfile.photoUrl === null`, `profile.onboardingComplete === true`, `workerJobCategorySlugs` contains exactly the two requested slugs (order-independent)

2. **Happy path — with optional fields**
   - Act: same as above + `bio: "Experienced F&B worker"`, `photoUrl: "https://mock.supabase.co/public/avatars/test-xyz.jpg"`
   - Assert: `bio` and `photoUrl` persisted to the DB row

3. **Idempotent — second call replaces categories and updates fields**
   - Arrange: create + complete worker profile with `fullName: "Jane"`, `jobCategories: ["retail", "cleaning"]`
   - Act: call `completeWorkerProfile` again with `fullName: "Jane Smith"`, `jobCategories: ["events"]`
   - Assert: `fullName === "Jane Smith"`, `workerJobCategorySlugs === ["events"]`, no `"retail"` or `"cleaning"` rows remain in `worker_job_category` for this user. Also verify exactly one `worker_profile` row exists for the user (upsert, not double-insert).

4. **Wrong role — employer tries to complete worker profile**
   - Arrange: `setRole("employer")`
   - Act: `completeWorkerProfile({ ... })`
   - Assert: rejects with `code: "BAD_REQUEST"`, `message === "You must select the worker role first."`

5. **No role yet — user skipped role-select**
   - Arrange: create user, no `setRole` call
   - Act: `completeWorkerProfile({ ... })`
   - Assert: rejects with `code: "BAD_REQUEST"`

6. **Invalid input — empty `jobCategories`**
   - Act: `completeWorkerProfile({ fullName: "Jane", phone: "+6512345678", jobCategories: [] })`
   - Assert: rejects at input validation (tRPC wraps Zod errors as `BAD_REQUEST`)

7. **Invalid input — `fullName` too short**
   - Act: `fullName: "X"` (1 char, below min 2)
   - Assert: rejects at input validation

8. **Unknown job category slug is rejected at validation, not silently dropped**
   - Act: `jobCategories: ["food-and-beverage", "nonexistent-slug"]` (cast as `JobCategorySlug` to bypass TS)
   - Assert: Zod enum on `JobCategorySlugSchema` rejects before the router runs — confirms the validation is at the schema layer, not dependent on the `inArray` filter inside the router

### `storage.getAvatarUploadUrl` test cases (5 tests)

`@supabase/supabase-js` is mocked at the module level so the test file never touches real Supabase credentials:

```ts
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn(async (path: string) => ({
          data: {
            signedUrl: `https://mock.supabase.co/upload/${path}?token=abc`,
            token: "abc",
            path,
          },
          error: null,
        })),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://mock.supabase.co/public/${path}` },
        })),
      })),
    },
  })),
}));
```

1. **Happy path** — returns `{ uploadUrl, token, path, publicUrl }` where `path === "${userId}.jpg"` and `uploadUrl` matches the mocked signed URL
2. **Path is scoped to the authenticated user** — assert `createSignedUploadUrl` was called with exactly `"${testUserId}.jpg"`, not any other path (guards a future refactor from accidentally allowing arbitrary paths)
3. **`upsert: true` is passed** — assert the mock received `{ upsert: true }` as the second arg (without this, second-upload requests fail with "The resource already exists")
4. **Supabase error bubbles up as `INTERNAL_SERVER_ERROR`** — override the mock to return `{ data: null, error: { message: "boom" } }` and assert the router throws `TRPCError` with `code: "INTERNAL_SERVER_ERROR"` and a message containing `"boom"`
5. **Unauthenticated — no session** — call with a context where `session === null`; `protectedProcedure` should throw `UNAUTHORIZED`

---

## Acceptance Criteria Map

Every Linear AC → exactly one or more artifacts in the plan:

| Linear AC                                                    | Where it lands                                                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| After role selection, worker enters single scrollable form   | AuthGuard rule 4 + `worker-profile.tsx` `ScrollView` root                                                                                                                                  |
| Full name (min 2 chars) required                             | `WorkerProfileSchema` + `<form.Field name="fullName">`                                                                                                                                     |
| Phone number required (stored, not verified)                 | `WorkerProfileSchema` min 6 + `keyboardType="phone-pad"` field                                                                                                                             |
| Job categories multi-select, ≥1 required                     | `WorkerProfileSchema` + `CategoryChips` + seed script                                                                                                                                      |
| Profile photo optional (camera or gallery)                   | `PhotoPicker` ActionSheet with both `launchCameraAsync` and `launchImageLibraryAsync` paths, plus camera + library permission requests and `expo-image-picker` plugin config in `app.json` |
| Short bio max 300 optional                                   | `WorkerProfileSchema` + multiline `<form.Field name="bio">` + live `X / 300` counter                                                                                                       |
| 8 predefined job categories                                  | `JOB_CATEGORIES` constant (already exists) + seed script populates DB + chips render from the same constant                                                                                |
| Photo placeholder with "Add a photo to improve your chances" | `PhotoPicker` idle state, blue text prompt below avatar                                                                                                                                    |
| On submission, `onboarding_complete = true`                  | `profile.completeWorkerProfile` transaction (already does this)                                                                                                                            |
| Lands on home (empty state)                                  | `router.replace("/")` on mutation success, `index.tsx` is the placeholder home                                                                                                             |
| Editable later from settings                                 | **OUT OF SCOPE** — follow-up ticket (FIN-12 or later)                                                                                                                                      |
| Skip optionals allowed                                       | `.optional()` on `bio` + `photoUrl` in Zod schema; `PhotoPicker` error state includes a "Remove" action                                                                                    |
| Image upload fails → retry + placeholder avatar              | `PhotoPicker` error state with Retry / Remove actions                                                                                                                                      |
| Very long name or bio → enforce client-side                  | Zod `.max(256)` on name, `.max(300)` on bio — enforced both client (TanStack Form) and server (tRPC input validation)                                                                      |
| No categories → inline error                                 | `CategoryChips` reads `field.state.meta.errors` and renders a destructive text line                                                                                                        |
| Force-close mid-form → blank on return                       | Default React state behavior — no draft saving, nothing to do                                                                                                                              |

---

## Risks and Mitigations

- **R1 — Supabase env vars in CI.** The `env.ts` Zod validator runs at module load, so simply mocking `@supabase/supabase-js` is not enough to keep the test suite from crashing on missing env vars. **Solution:** ship dummy-but-schema-valid values for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.example` (see "CI env-var strategy" in the Testing section). The vitest-level `@supabase/supabase-js` mock means these dummy values are never actually used to make a real API call. Production reads real values from Vercel env vars; local dev reads them from a developer's `.env` file. **No GitHub Actions secrets needed for FIN-9.**
- **R2 — Orphan files accumulating.** Every abandoned-onboarding worker leaves ≤1 file at `avatars/{userId}.jpg`. For MVP scale (tens to hundreds of users) this is invisible. **Action:** file a follow-up ticket for a weekly Vercel Cron that lists the `avatars/` bucket and deletes any file whose path-derived userId doesn't appear in `worker_profile.photo_url`.
- **R3 — Bucket existence is a manual infra step.** The first person to run against a fresh Supabase project will hit a runtime error when the router tries to `createSignedUploadUrl` on a non-existent bucket. **Action:** README "One-time Supabase Storage setup" subsection explicitly lists bucket creation; router error message surfaces the underlying Supabase error rather than a generic 500, so misconfiguration is diagnosable immediately during smoke testing.
- **R4 — `expo-image-picker` / `expo-image-manipulator` version skew with Expo SDK 55.** We've been bitten by version drift before. **Action:** use `pnpm -F @findgigs/mobile expo install <pkg>` to let Expo's CLI resolve the SDK-compatible versions automatically.
- **R5 — TanStack React Form's Zod integration on React Native with a larger schema.** It works in `signup.tsx`/`login.tsx`, so the mobile runtime is proven, but our schema is more complex (5 fields, nested array, optionals). **Action:** the first implementation task in the plan is a scaffold-only form (hardcoded defaults, no submit handler) — proves the Zod wiring works before building out PhotoPicker / CategoryChips.
- **R6 — The `completeWorkerProfile` router already exists but is untested.** If the existing implementation has a bug, we'll discover it in the first test-writing task. **Action:** none — that's exactly what tests are for. If a bug surfaces, fix it in the same PR.

---

## Follow-up tickets (post-merge)

1. **FIN-XX orphan cleanup cron** — Vercel Cron (weekly) listing `avatars/` bucket and deleting files unreferenced by `worker_profile.photo_url`
2. **FIN-XX private bucket migration** (optional, long-term) — if avatar visibility ever needs to be gated
3. **FIN-XX Info.plist permission string audit** — re-check all other native permissions are correctly described while we're touching `app.json`
4. **FIN-12 edit worker profile from settings** — the "editable later from settings" AC from this ticket, carried over

---

## Rollout

- Branch name: `bubuding0809/fin-9-worker-profile-creation` (matches Linear `gitBranchName` — required for auto-close on merge)
- **Before push**: `pnpm exec turbo run lint typecheck build test` (the full CI gate locally, not just typecheck+test — locked in from the FIN-8 post-mortem)
- **Before push**: user has manually created the `avatars` bucket in the Supabase dashboard (one-time op, documented in README delta) and added the real `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to their local `.env` for smoke testing
- **No GitHub Actions secrets needed for CI** — dummy values from `.env.example` plus the vitest-level Supabase mock are sufficient for the test suite to pass
- **Production env vars** — once the bucket exists, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Vercel env vars (`vercel env add ...`) for the production deploy. This is a separate one-time op, not a per-PR concern.
- Single PR, full scope
- After merge: mark FIN-9 Done in Linear (auto-close should fire if the branch name matches — verify)
