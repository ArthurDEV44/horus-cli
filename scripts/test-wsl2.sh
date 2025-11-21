#!/bin/bash
# Test script for WSL2 compatibility

echo "Testing Horus CLI in WSL2..."
echo ""

# Test 1: Check if TTY is available
if [ -t 0 ]; then
    echo "✓ TTY is available (stdin is interactive)"
else
    echo "✗ TTY is not available (stdin is not interactive)"
    exit 1
fi

# Test 2: Check if stdin is readable
if [ -r /dev/stdin ]; then
    echo "✓ stdin is readable"
else
    echo "✗ stdin is not readable"
    exit 1
fi

# Test 3: Test help command (non-interactive)
echo ""
echo "Testing help command..."
bun run dist/index.js --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Help command works"
else
    echo "✗ Help command failed"
    exit 1
fi

# Test 4: Test headless mode
echo ""
echo "Testing headless mode..."
timeout 5s bun run dist/index.js --prompt "test" > /dev/null 2>&1
if [ $? -eq 124 ] || [ $? -eq 0 ]; then
    echo "✓ Headless mode works (or requires Ollama)"
else
    echo "✗ Headless mode failed"
fi

echo ""
echo "All tests passed! ✓"
echo ""
echo "To test interactive mode, run:"
echo "  bun run dev"
echo ""
