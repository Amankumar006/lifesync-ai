#!/usr/bin/env bash
# PreInvocation hook — fires before the model is called
# Injects a brief context reminder so the agent stays on-track
# across long sessions without drifting

INPUT=$(cat)

# Only inject on first invocation (invocationNum == 0) to avoid noise
INVOCATION_NUM=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('invocationNum', 0))
except:
    print(0)
" 2>/dev/null)

if [ "$INVOCATION_NUM" -eq 0 ]; then
  echo '{
    "injectSteps": [
      {
        "ephemeralMessage": "Context: You are working on the Personal AI Agent project. Stack: Expo SDK 55 (mobile) + FastAPI + LangGraph v1 (backend) + Firebase. Key constraint: always use AsyncPostgresSaver for checkpointer, never InMemorySaver. The graph must compile with both checkpointer= and store=. Check .agents/skills/ for task-specific instructions before writing code."
      }
    ]
  }'
else
  echo '{"injectSteps": []}'
fi
