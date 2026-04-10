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
    createSignedUploadUrlMock.mockImplementation((path: string) => ({
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
      const result = await caller.storage.getAvatarUploadUrl({
        contentType: "image/jpeg",
        contentLength: 12345,
      });

      expect(result).toEqual({
        uploadUrl: `https://mock.supabase.co/upload/${testUserId}.jpg?token=abc`,
        token: "abc",
        path: `${testUserId}.jpg`,
        publicUrl: `https://mock.supabase.co/public/${testUserId}.jpg`,
      });
    });

    it("calls createSignedUploadUrl with the user-scoped path", async () => {
      await caller.storage.getAvatarUploadUrl({
        contentType: "image/jpeg",
        contentLength: 12345,
      });

      expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
        `${testUserId}.jpg`,
        expect.any(Object),
      );
    });

    it("passes { upsert: true } so repeated uploads don't error", async () => {
      await caller.storage.getAvatarUploadUrl({
        contentType: "image/jpeg",
        contentLength: 12345,
      });

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

      await expect(
        caller.storage.getAvatarUploadUrl({
          contentType: "image/jpeg",
          contentLength: 12345,
        }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.stringContaining("Failed to generate upload link."),
      });
    });

    it("is a protected procedure — rejects when there is no session", async () => {
      const { appRouter } = await import("../../root");
      const { db } = await import("@findgigs/db/client");
      const unauthCaller = appRouter.createCaller({
        db,
        authApi: {} as never,
        session: null,
      } as never);

      await expect(
        unauthCaller.storage.getAvatarUploadUrl({
          contentType: "image/jpeg",
          contentLength: 12345,
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});
