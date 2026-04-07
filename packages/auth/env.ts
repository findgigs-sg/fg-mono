import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(1)
          : z.string().min(1).optional(),
      NODE_ENV: z.enum(["development", "production"]).optional(),
      // Google OAuth
      GOOGLE_CLIENT_ID: z.string().min(1).optional(),
      GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
      // Apple Sign-In
      APPLE_CLIENT_ID: z.string().min(1).optional(),
      APPLE_CLIENT_SECRET: z.string().min(1).optional(),
      APPLE_APP_BUNDLE_ID: z.string().min(1).optional(),
    },
    runtimeEnv: process.env,
    skipValidation:
      process.env.SKIP_ENV_VALIDATION === "true" ||
      process.env.npm_lifecycle_event === "lint",
  });
}
