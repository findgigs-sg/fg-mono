import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@findgigs/eslint-config/base";

export default defineConfig(
  {
    ignores: ["script/**"],
  },
  baseConfig,
  restrictEnvAccess,
);
