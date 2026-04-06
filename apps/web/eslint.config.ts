import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@findgigs/eslint-config/base";
import { reactConfig } from "@findgigs/eslint-config/react";

export default defineConfig(
  {
    ignores: [".nitro/**", ".output/**", ".tanstack/**"],
  },
  baseConfig,
  reactConfig,
  restrictEnvAccess,
);
