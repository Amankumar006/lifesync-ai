#!/usr/bin/env bash
# PostToolUse hook — runs after file writes in backend/
# Quick smoke test: checks if FastAPI server is running and responsive

INPUT=$(cat)

TARGET=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    args = data.get('toolCall', {}).get('args', {})
    print(args.get('TargetFile', ''))
except:
    print('')
" 2>/dev/null)

# Only run for backend Python files
if [[ "$TARGET" != *"backend/"* ]] || [[ "$TARGET" != *".py" ]]; then
  echo "{}"
  exit 0
fi

# Try to hit the health endpoint if server is running
HEALTH=$(curl -s --max-time 2 http://localhost:8000/health 2>/dev/null)

if [ -n "$HEALTH" ]; then
  # Server is running — check if it responded with OK
  if echo "$HEALTH" | grep -q '"status"'; then
    : # All good, no output needed
  else
    echo "⚠️  Backend health check returned unexpected response: $HEALTH" >&2
  fi
fi
# If server isn't running yet, that's fine — just skip

echo "{}"
