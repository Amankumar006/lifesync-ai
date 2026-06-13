#!/usr/bin/env bash
# PreToolUse hook — fires before any file write
# Guards against SDK 55 anti-patterns in app.json and mobile files

INPUT=$(cat)

# Extract content and target file
CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    args = data.get('toolCall', {}).get('args', {})
    print(args.get('CodeContent', '') or args.get('ReplacementContent', ''))
except:
    print('')
" 2>/dev/null)

TARGET=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    args = data.get('toolCall', {}).get('args', {})
    print(args.get('TargetFile', ''))
except:
    print('')
" 2>/dev/null)

# Only check app.json and mobile files
if [[ "$TARGET" == *"app.json"* ]]; then
  if echo "$CONTENT" | grep -q "newArchEnabled"; then
    echo '{
      "decision": "ask",
      "reason": "⛔ Expo Guard: newArchEnabled found in app.json. This flag is REMOVED in SDK 55 — the New Architecture is always on and cannot be disabled. Remove this field."
    }'
    exit 0
  fi
fi

# Check for expo-av usage (removed in SDK 55)
if [[ "$TARGET" == *"mobile/"* ]]; then
  if echo "$CONTENT" | grep -q "expo-av"; then
    echo '{
      "decision": "ask",
      "reason": "⛔ Expo Guard: expo-av is removed in SDK 55. Use expo-audio for audio and expo-video for video instead."
    }'
    exit 0
  fi
fi

echo '{"decision": "allow"}'
