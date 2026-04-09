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
      expect(profile!.id).toBeDefined();
    });

    it("is idempotent when called twice with the same role", async () => {
      const first = await caller.profile.setRole({ role: "employer" });
      const second = await caller.profile.setRole({ role: "employer" });
      expect(second!.id).toBe(first!.id);
      expect(second!.role).toBe("employer");
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
