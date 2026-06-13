# TypeScript & React Native Style Rule
# Activation: Glob → mobile/**/*.ts, mobile/**/*.tsx
# Applied automatically to all TypeScript files in the mobile folder.

## TypeScript Conventions

### Always type props explicitly
```typescript
// ✅
type ScheduleBlockProps = {
  block: { time: string; title: string; type: string; duration_min: number; notes?: string };
  onPress?: () => void;
};
export function ScheduleBlock({ block, onPress }: ScheduleBlockProps) { ... }

// ❌
export function ScheduleBlock({ block, onPress }: any) { ... }
```

### Environment variables
Always use `EXPO_PUBLIC_` prefix for vars that need to be accessible on the client:
```typescript
// ✅
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

// ❌ — this won't work in Expo
const apiUrl = process.env.API_URL;
```

## React Native Conventions

### StyleSheet — always use it, never inline styles in JSX
```typescript
// ✅
const styles = StyleSheet.create({ container: { flex: 1 } });
<View style={styles.container} />

// ❌
<View style={{ flex: 1 }} />
```

### No `<form>` tags — use event handlers
This is React Native, not web. Use `onPress` / `onChangeText`:
```typescript
// ✅
<TextInput onChangeText={setText} />
<Pressable onPress={handleSubmit}><Text>Submit</Text></Pressable>

// ❌ — will not work in RN
<form onSubmit={handleSubmit}>...</form>
```

### Firestore Listeners — Always Clean Up
```typescript
useEffect(() => {
  const unsub = firestore().collection("schedules")...onSnapshot(...);
  return unsub;  // ← always return the unsubscribe function
}, [uid]);
```

### Color Palette — Use These Constants
```typescript
// mobile/constants/colors.ts
export const colors = {
  bg: "#0c0e14",
  surface: "#121520",
  border: "#1e2130",
  text: "#dde1f0",
  muted: "#5a6080",
  green: "#3dffa0",
  blue: "#5ba4ff",
  orange: "#ff8c42",
  purple: "#c678ff",
  yellow: "#ffd080",
  red: "#ff5c7a",
};
```

### Thread IDs for useChat
Generate a stable thread ID per session (stored in device storage):
```typescript
import * as SecureStore from "expo-secure-store";
import { v4 as uuid } from "uuid";

async function getOrCreateThreadId(): Promise<string> {
  let id = await SecureStore.getItemAsync("thread_id");
  if (!id) {
    id = uuid();
    await SecureStore.setItemAsync("thread_id", id);
  }
  return id;
}
```
