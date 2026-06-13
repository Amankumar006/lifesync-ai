#!/usr/bin/env bash
# PostToolUse hook — runs after any file write in backend/
# Checks if the written file is a Python file and lints it

# Read stdin (JSON input from Antigravity)
INPUT=$(cat)

# Extract the target file path from the tool args if available
# For PostToolUse, we check if any .py files in backend/ have issues
BACKEND_DIR="$(pwd)/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "{}"
  exit 0
fi

# Only lint if ruff is available
if ! command -v ruff &> /dev/null; then
  echo "{}"
  exit 0
fi

# Run ruff on the backend directory (fast, non-blocking check)
LINT_OUTPUT=$(cd "$BACKEND_DIR" && ruff check app/ --select E,F,W --quiet 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ] && [ -n "$LINT_OUTPUT" ]; then
  # Output is visible in Antigravity's tool result panel
  echo "⚠️  Lint issues found:" >&2
  echo "$LINT_OUTPUT" >&2
fi

# PostToolUse must return empty JSON object
echo "{}"
