---
name: Vercel CLI with token skill
description: Always use vercel-cli-with-tokens skill and grab token from .envrc when doing Vercel CLI operations
type: feedback
---

When doing anything with the Vercel CLI, always load the `vercel-cli-with-tokens` skill first and use the token from the environment (loaded via `.envrc` / direnv).

**Why:** User has token-based auth set up via .envrc rather than interactive login. Using the skill ensures correct token handling.

**How to apply:** Before any `vercel` CLI command, invoke `Skill(vercel-cli-with-tokens)` and read the token from the environment variables available via `.envrc`.
