#!/usr/bin/env bash
# PreToolUse hook — fires before any file write
# Guards against the most common LangGraph production mistake:
# using InMemorySaver or MemorySaver instead of AsyncPostgresSaver

# Read the tool call input from stdin
INPUT=$(cat)

# Extract the file content being written (from CodeContent field)
CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    args = data.get('toolCall', {}).get('args', {})
    print(args.get('CodeContent', '') or args.get('ReplacementContent', '') or args.get('TargetContent', ''))
except:
    print('')
" 2>/dev/null)

# Check for forbidden memory patterns
if echo "$CONTENT" | grep -qE "InMemorySaver|MemorySaver\(\)"; then
  echo '{
    "decision": "ask",
    "reason": "⛔ Memory Guard: InMemorySaver or MemorySaver detected. This project uses AsyncPostgresSaver for the checkpointer — InMemorySaver is test-only and loses all state on restart. Please use AsyncPostgresSaver.from_conn_string(settings.DB_URI) instead."
  }'
  exit 0
fi

# Check for missing store= in compile() call
if echo "$CONTENT" | grep -q "builder.compile(" && ! echo "$CONTENT" | grep -q "store="; then
  echo '{
    "decision": "ask",
    "reason": "⛔ Memory Guard: builder.compile() found without store= parameter. This project requires BOTH checkpointer= (session memory) and store= (cross-session memory). Long-term user preferences will be lost without the store."
  }'
  exit 0
fi

# All clear — allow the write
echo '{"decision": "allow"}'
