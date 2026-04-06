---
name: Always raise PR after development
description: After completing any development flow (superpowers, feature-dev, or manual), always create a PR instead of just leaving changes on a branch
type: feedback
---

Always raise a PR (via `gh pr create`) when finishing a development flow — whether using superpowers, feature-dev, or any other workflow.

**Why:** User wants completed work to go through PR review rather than sitting on branches or being merged directly.

**How to apply:** At the end of any development branch work, after verifying tests/lint pass, create a PR targeting main. Don't wait for the user to ask — do it as the final step of the workflow.
