import type { Config } from "drizzle-kit";

if (!process.env.DIRECT_URL) {
  throw new Error("Missing DIRECT_URL");
}

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
  casing: "snake_case",
} satisfies Config;
