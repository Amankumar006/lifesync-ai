#!/usr/bin/env bash
# Stop hook — fires when the agent execution loop terminates
# Prints a brief summary of what was done

INPUT=$(cat)

REASON=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('terminationReason', 'unknown'))
except:
    print('unknown')
" 2>/dev/null)

FULLY_IDLE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('fullyIdle', True))
except:
    print(True)
" 2>/dev/null)

# Log session end to a simple file for reference
LOGFILE=".agents/session.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Session ended — reason: $REASON, fully_idle: $FULLY_IDLE" >> "$LOGFILE" 2>/dev/null

# Always allow the stop (don't force continue)
echo '{"decision": ""}'
