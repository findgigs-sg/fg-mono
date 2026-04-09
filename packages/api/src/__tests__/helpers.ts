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
