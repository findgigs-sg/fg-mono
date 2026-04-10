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
      expect(profile.id).toBeDefined();
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
});
