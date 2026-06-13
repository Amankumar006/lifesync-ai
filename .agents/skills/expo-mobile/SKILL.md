---
name: expo-mobile
description: Builds and modifies the Expo SDK 55 React Native mobile app for the Personal AI Agent. Use when creating new screens, adding navigation, wiring the AI SDK 5 useChat hook to the FastAPI backend, setting up push notifications, handling geofencing triggers, building schedule UI components, or configuring app.json. Also use when the user asks about Expo Router v4, Firebase Auth on mobile, or Expo Go vs development builds.
---

# Expo Mobile Skill

You are building the mobile frontend of the Personal AI Agent using **Expo SDK 55** with **React Native 0.83** and **Expo Router v4**.

## Critical SDK 55 Facts

- **New Architecture is mandatory and cannot be disabled.** The `newArchEnabled` flag is removed from `app.json` — do not add it.
- Ships with React Native 0.83 and React 19.2
- `expo-av` is removed — use `expo-audio` and `expo-video` separately if needed
- Hermes v1 is the JS engine (faster cold starts, better ES6)
- SDK 56 (with RN 0.85) arrives May/June 2026 — start on 55, plan to upgrade

## app.json — Correct SDK 55 Config

```json
{
  "expo": {
    "name": "Personal AI Agent",
    "slug": "personal-ai-agent",
    "version": "1.0.0",
    "sdkVersion": "55.0.0",
    "scheme": "agent",
    "plugins": [
      "expo-router",
      "expo-notifications",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow location access for context-aware schedule reminders (gym proximity, library arrival)."
        }
      ]
    ],
    "android": {
      "package": "com.yourname.aiagent",
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#0c0e14"
      }
    },
    "ios": {
      "bundleIdentifier": "com.yourname.aiagent"
    }
  }
}
```

## Folder Structure

```
mobile/app/
├── (tabs)/
│   ├── _layout.tsx      ← Tab bar config
│   ├── index.tsx        ← Chat screen (main agent interface)
│   ├── schedule.tsx     ← Daily/weekly schedule view
│   └── profile.tsx      ← User preferences / onboarding
├── _layout.tsx          ← Root layout (auth gate here)
└── onboarding.tsx       ← First-time profile setup

mobile/hooks/
├── useAgentChat.ts      ← useChat wrapper → FastAPI SSE
├── useSchedule.ts       ← Schedule state + Firestore listener
└── useGeofence.ts       ← Location triggers

mobile/services/
├── firebase.ts          ← Firebase init
├── api.ts               ← Axios instance with auth headers
└── notifications.ts     ← Expo push notification registration

mobile/components/
├── ChatBubble.tsx
├── ScheduleBlock.tsx    ← Colored time block component
└── DayView.tsx          ← Full day schedule renderer
```

## useAgentChat Hook — AI SDK 5

```typescript
// mobile/hooks/useAgentChat.ts
import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";

export function useAgentChat(threadId: string) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      user.getIdToken().then(setToken);
    }
  }, []);

  return useChat({
    api: `${process.env.EXPO_PUBLIC_API_URL}/api/chat`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: {
      user_id: auth().currentUser?.uid,
      thread_id: threadId,
    },
    onError: (err) => console.error("Agent error:", err),
  });
}
```

## Push Notifications Setup

```typescript
// mobile/services/notifications.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;  // won't work on simulator

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  });
  return token.data;
}
```

## Geofencing — Location Triggers

```typescript
// mobile/hooks/useGeofence.ts
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

const GEOFENCE_TASK = "GEOFENCE_TASK";

// Define what happens when geofence fires
TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
  if (error) return;
  const { eventType, region } = data as any;
  if (eventType === Location.GeofencingEventType.Enter) {
    // "region.identifier" tells you which place (gym, library, etc.)
    handleLocationEnter(region.identifier);
  }
});

export async function setupGeofences(locations: {
  id: string; lat: number; lng: number; radius: number;
}[]) {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") return;

  await Location.startGeofencingAsync(
    GEOFENCE_TASK,
    locations.map(l => ({
      identifier: l.id,
      latitude: l.lat,
      longitude: l.lng,
      radius: l.radius,  // meters
    }))
  );
}
```

## Schedule Block Component

```typescript
// mobile/components/ScheduleBlock.tsx
import { View, Text, StyleSheet } from "react-native";

const TYPE_COLORS = {
  work:     "#5ba4ff",
  study:    "#c678ff",
  personal: "#3dffa0",
  health:   "#ff8c42",
  rest:     "#ffd080",
  ent:      "#ff5c7a",
};

type Block = {
  time: string; title: string; type: keyof typeof TYPE_COLORS;
  duration_min: number; notes?: string;
};

export function ScheduleBlock({ block }: { block: Block }) {
  const color = TYPE_COLORS[block.type] ?? "#6b7599";
  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <Text style={styles.time}>{block.time}</Text>
      <View style={styles.content}>
        <Text style={styles.title}>{block.title}</Text>
        {block.notes && <Text style={styles.notes}>{block.notes}</Text>}
      </View>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 10, marginBottom: 4, backgroundColor: "#121520" },
  time: { width: 48, fontSize: 10, color: "#4a5278", fontFamily: "monospace" },
  content: { flex: 1 },
  title: { fontSize: 13, color: "#eef0f8", fontWeight: "600" },
  notes: { fontSize: 10, color: "#6b7599", marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, alignSelf: "center" },
});
```

## Running on a Physical Android Device

```bash
# EXPO_PUBLIC_API_URL must be your machine's LAN IP — not localhost
# localhost on the device refers to the device itself, not your computer
echo "EXPO_PUBLIC_API_URL=http://192.168.x.x:8000" > .env

npx expo start --clear
# Press 'a' for Android emulator or scan QR with Expo Go app
```

## Dev Build vs Expo Go

- **Expo Go**: Use for all screens that don't need native modules (chat, schedule display)
- **Dev Build required for**: Background location (geofencing), background fetch, push notifications
  ```bash
  npx expo run:android  # builds a dev APK with all native modules
  ```
