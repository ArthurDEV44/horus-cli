---
description: "Review code changes in the current branch"
argument-hint: "[file or path]"
---

Review the code changes $ARGUMENTS with focus on:

1. **Code Quality**: Clean code principles, readability, maintainability
2. **Bugs**: Potential bugs, edge cases, error handling
3. **Security**: Security vulnerabilities, input validation
4. **Performance**: Performance issues, unnecessary complexity
5. **Best Practices**: TypeScript/JavaScript best practices

If no specific file is provided, review the git diff of staged or unstaged changes.

For each issue found:
- Describe the problem
- Explain why it matters
- Suggest a specific fix

Be concise but thorough.
