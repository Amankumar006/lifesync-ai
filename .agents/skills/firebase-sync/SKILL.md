---
name: firebase-sync
description: Manages all Firebase integration for the Personal AI Agent — Firestore data schema, real-time listeners for schedule sync, Firebase Auth on both mobile (React Native SDK) and backend (Firebase Admin JWT verification), and Firestore security rules. Use when writing to or reading from Firestore, updating the college timetable, task queue, or user preferences, handling auth state changes, or setting up real-time schedule listeners on the mobile app.
---

# Firebase Sync Skill

Firebase powers two things in this project: **Auth** (identity) and **Firestore** (real-time data sync). The mobile app reads/writes Firestore directly via the React Native SDK. The backend reads Firestore via Firebase Admin only for the timetable MCP tool.

## Firestore Document Schema

Three top-level collections — never add more without updating security rules:

```
users/{uid}
  → name: string
  → role: "student" | "professional" | "both"
  → wake_time: string           ("06:30")
  → sleep_target: string        ("23:30")
  → peak_focus_time: string     ("evening")
  → study_block_pref: string    ("90min")
  → gym_days: string[]          (["Tue", "Thu", "Sat"])
  → gym_time: string            ("18:30")
  → college_name: string
  → year: number
  → push_token: string          (Expo push token)
  → onboarding_complete: bool
  → created_at: timestamp

timetables/{uid}
  → Monday: [{time: "09:00", subject: "DSA", room: "A101", textbooks: ["CLRS Ch.22"]}]
  → Tuesday: [...]
  → Wednesday: [...]
  → Thursday: [...]
  → Friday: [...]
  → Saturday: []
  → Sunday: []

tasks/{uid}/items/{taskId}
  → title: string               ("DBMS Assignment")
  → type: "assignment"|"exam"|"project"|"reminder"
  → due_date: string            ("2026-06-10")
  → priority: "critical"|"high"|"medium"|"low"
  → completed: bool
  → created_at: timestamp
  → subject: string

schedules/{uid}/days/{YYYY-MM-DD}
  → blocks: [{time, title, type, duration_min, notes}]
  → approved: bool
  → created_at: timestamp
```

## Mobile: Firestore Listener for Live Schedule

```typescript
// mobile/hooks/useSchedule.ts
import firestore from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";
import { format } from "date-fns";

type ScheduleBlock = {
  time: string; title: string; type: string;
  duration_min: number; notes?: string;
};

export function useSchedule(uid: string, date: Date) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const dateKey = format(date, "yyyy-MM-dd");

  useEffect(() => {
    if (!uid) return;
    // Real-time listener — updates instantly when agent commits schedule
    const unsub = firestore()
      .collection("schedules")
      .doc(uid)
      .collection("days")
      .doc(dateKey)
      .onSnapshot(snap => {
        if (snap.exists()) {
          setBlocks(snap.data()?.blocks ?? []);
        }
      });
    return unsub;  // cleanup on unmount
  }, [uid, dateKey]);

  return blocks;
}
```

## Mobile: Write Timetable to Firestore

```typescript
// Called during onboarding after user inputs their schedule
import firestore from "@react-native-firebase/firestore";

export async function saveTimetable(uid: string, timetable: Record<string, any[]>) {
  await firestore()
    .collection("timetables")
    .doc(uid)
    .set(timetable, { merge: true });
}
```

## Mobile: Task Queue Listener

```typescript
import firestore from "@react-native-firebase/firestore";

export function useTaskQueue(uid: string) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    return firestore()
      .collection("tasks").doc(uid)
      .collection("items")
      .where("completed", "==", false)
      .orderBy("due_date", "asc")
      .onSnapshot(snap => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
  }, [uid]);

  return tasks;
}
```

## Backend: Reading Timetable in MCP Tool

```python
# backend/app/tools/timetable.py
from firebase_admin import firestore_async
from langchain_core.tools import tool
import datetime

@tool
async def fetch_timetable(user_id: str, date: str) -> dict:
    """Fetch college timetable for a specific date. Returns fixed class blocks."""
    db = firestore_async.client()
    doc = await db.collection("timetables").document(user_id).get()
    if not doc.exists:
        return {"classes": [], "weekday": ""}
    weekday = datetime.datetime.fromisoformat(date).strftime("%A")
    return {
        "classes": doc.to_dict().get(weekday, []),
        "weekday": weekday
    }
```

## Firestore Security Rules

```javascript
// firestore.rules — deploy with: firebase deploy --only firestore:rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Timetables: user owns their own
    match /timetables/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Tasks: subcollection scoped to user
    match /tasks/{uid}/items/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Schedules: user read/write, backend writes via Admin SDK (bypasses rules)
    match /schedules/{uid}/days/{day} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Auth State — Mobile Root Layout

```typescript
// mobile/app/_layout.tsx
import auth from "@react-native-firebase/auth";
import { router, Slot } from "expo-router";
import { useEffect, useState } from "react";

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(user => {
      if (!user) router.replace("/onboarding");
      if (initializing) setInitializing(false);
    });
    return unsub;
  }, []);

  if (initializing) return null;
  return <Slot />;
}
```

## Firestore Indexes Required

Add to `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "completed", "order": "ASCENDING" },
        { "fieldPath": "due_date", "order": "ASCENDING" }
      ]
    }
  ]
}
```

Deploy: `firebase deploy --only firestore:indexes`
