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
