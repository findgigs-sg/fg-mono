import { defineConfig } from "eslint/config";

import { baseConfig } from "@findgigs/eslint-config/base";
import { reactConfig } from "@findgigs/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
