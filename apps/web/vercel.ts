import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nitropack",
  buildCommand: "pnpm build",
  installCommand: "pnpm install",
  git: {
    deploymentEnabled: {
      main: false,
    },
  },
  ignoreCommand: "npx turbo-ignore",
  regions: ["sin1"],
};
