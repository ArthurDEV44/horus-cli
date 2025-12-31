---
description: "Create a pull request with AI-generated description"
argument-hint: "[base-branch]"
---

Create a pull request for the current branch.

1. First, check if there are uncommitted changes and commit them if needed
2. Push the current branch to origin
3. Generate a comprehensive PR description by analyzing:
   - All commits since branching from $ARGUMENTS (default: main)
   - The overall changes and their purpose
   - Any breaking changes or migration steps needed

4. Create the PR using `gh pr create` with:
   - A clear, descriptive title based on the changes
   - A detailed body following this format:
     ## Summary
     [Brief description of what this PR does]

     ## Changes
     [Bullet list of key changes]

     ## Testing
     [How to test these changes]

If `gh` CLI is not available, output the PR description for manual creation.
