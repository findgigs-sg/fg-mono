import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nitro",
  buildCommand: "pnpm tsx ../../scripts/check-env.ts && pnpm build",
  installCommand: "pnpm install",
  git: {
    deploymentEnabled: {
      main: false,
    },
  },
  ignoreCommand: "npx turbo-ignore",
  regions: ["sin1"],
};
