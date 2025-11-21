# WSL2 Troubleshooting Guide

## EPERM Error on First Keypress

### Problem
When running Horus CLI in WSL2, you may encounter an `EPERM: operation not permitted, read` error when typing the first character in the interactive prompt.

### Root Cause
This is a known issue with Node.js applications using terminal libraries (like Ink) in WSL2. The error occurs when stdin is accessed in raw mode before it's properly initialized.

### Solution Implemented
The codebase includes several fixes for this issue:

1. **stdin initialization** (`src/index.ts`):
   - `ensureStdinReady()` function configures stdin before launching the interactive UI
   - Sets proper encoding and removes conflicting listeners
   - Adds error handler for EPERM errors specific to WSL2

2. **Global error handling** (`src/index.ts`):
   - Uncaught EPERM errors from stdin (fd: 0) are silently ignored
   - Application continues running despite these transient errors

3. **Hook-level protection** (`src/hooks/use-input-handler.ts`):
   - Error boundary around `useInput` hook catches EPERM errors
   - Prevents crashes during input handling

### Testing the Fix

After building, test the application:

```bash
# Build the project
bun run build

# Test help command (should work)
bun run dist/index.js --help

# Test interactive mode in WSL2
bun run dev
```

### If Issues Persist

If you still encounter EPERM errors:

1. **Verify your terminal**:
   ```bash
   # Check if TTY is available
   [ -t 0 ] && echo "TTY OK" || echo "No TTY"
   ```

2. **Try a different terminal**:
   - Windows Terminal (recommended)
   - VS Code integrated terminal
   - Native Ubuntu terminal in WSL2

3. **Check Node.js version**:
   ```bash
   node --version  # Should be >= 18.0.0
   ```

4. **Check Bun version** (if using Bun):
   ```bash
   bun --version  # Should be >= 1.0.0
   ```

5. **Reset terminal state**:
   ```bash
   reset
   stty sane
   ```

### Alternative: Headless Mode

If interactive mode continues to have issues, use headless mode which doesn't require stdin:

```bash
# Single command execution
horus --prompt "show me the package.json file"

# Git operations
horus git commit-and-push
```

## Other WSL2 Considerations

### Ollama in WSL2
If running Ollama in WSL2, ensure it's accessible:

```bash
# Check if Ollama is running
curl http://localhost:11434/v1/models

# Start Ollama if needed
ollama serve &
```

### File System Performance
WSL2 file system can be slow when accessing Windows files (`/mnt/c/...`). For best performance:
- Work in Linux file system: `~/code/` instead of `/mnt/c/Users/...`
- Current working directory: `/home/sauron/code/horus-cli-ts`

## Related Issues

- [Ink issue #360](https://github.com/vadimdemedes/ink/issues/360): stdin issues in Docker/WSL
- [Node.js WSL2 documentation](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

## Successfully Tested Environments

✅ WSL2 Ubuntu 20.04+ with Windows Terminal
✅ WSL2 Ubuntu 22.04+ with VS Code terminal
✅ Native Linux (no WSL)
✅ macOS terminal

⚠️ May have issues in:
- PowerShell (use Windows Terminal instead)
- CMD.exe (use Windows Terminal instead)
- Docker containers without proper TTY allocation
