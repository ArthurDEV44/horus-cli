#!/bin/bash
# Test script for interactive mode debugging

echo "=== Testing Horus CLI Interactive Mode ==="
echo ""
echo "This will launch the CLI with DEBUG mode enabled."
echo "Type a single character and observe what happens."
echo ""
echo "Press Ctrl+C to exit if it hangs."
echo ""
echo "Starting in 2 seconds..."
sleep 2

# Launch with debug mode
DEBUG=1 bun run dist/index.js
