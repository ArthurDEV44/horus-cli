---
description: "Run tests and analyze failures"
argument-hint: "[test pattern]"
---

Run tests $ARGUMENTS and analyze the results:

1. Execute the test command (detect from package.json: npm test, bun test, jest, vitest, etc.)
2. If tests pass, report success with a brief summary
3. If tests fail:
   - Parse the error output
   - Identify the failing test(s)
   - Read the relevant test file and source code
   - Explain what's failing and why
   - Suggest specific fixes

Focus on actionable feedback. Don't just repeat the error - explain the root cause and how to fix it.
