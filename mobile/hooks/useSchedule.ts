import { useEffect, useState } from "react";
import { firestoreService, authService } from "../services/firebase";

export type ScheduleBlock = {
  id?: string;
  time: string;
  title: string;
  type: "work" | "study" | "personal" | "health" | "rest" | "ent";
  duration_min: number;
  notes?: string;
  completed?: boolean;
  skipped?: boolean;
};

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekdayMode(): "weekday" | "weekend" {
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

export function useSchedule(dateKey?: string) {
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMode, setCurrentMode] = useState<"weekday" | "weekend">(getWeekdayMode());
  const [userId, setUserId] = useState<string>("");

  const resolvedDate = dateKey || getTodayDateKey();

  useEffect(() => {
    const unsubAuth = authService.onAuthStateChanged((user: any) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId("");
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!userId) {
      setSchedule([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const firestorePath = `schedules/${userId}/days/${resolvedDate}`;

    const unsubscribe = firestoreService.onSnapshot(
      firestorePath,
      (snap: any) => {
        try {
          const exists = typeof snap.exists === "function" ? snap.exists() : snap.exists;
          if (exists) {
            const data = typeof snap.data === "function" ? snap.data() : snap;
            const blocks: ScheduleBlock[] = data?.blocks ?? [];
            if (blocks.length > 0) {
              const sorted = [...blocks].sort((a, b) => a.time.localeCompare(b.time));
              setSchedule(sorted);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn("Error parsing schedule snapshot:", err);
        }
        setSchedule([]);
        setLoading(false);
      },
      (error: any) => {
        console.warn("Firestore schedule listener error:", error);
        setSchedule([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId, resolvedDate]);

  const toggleMode = async () => {
    const nextMode = currentMode === "weekday" ? "weekend" : "weekday";
    setCurrentMode(nextMode);
    try {
      await firestoreService.update(`users/${userId}`, { currentMode: nextMode });
    } catch (e) {
      console.warn("Failed to sync mode to Firestore, continuing locally.");
    }
  };

  const updateBlockStatus = async (blockIndex: number, status: "completed" | "skipped" | "none") => {
    try {
      const updatedBlocks = schedule.map((block, idx) => {
        if (idx === blockIndex) {
          return {
            ...block,
            completed: status === "completed",
            skipped: status === "skipped",
          };
        }
        return block;
      });

      // Update state locally first for fast feedback
      setSchedule(updatedBlocks);

      // Save to Firestore (only if not using mock fallback)
      const firestorePath = `schedules/${userId}/days/${resolvedDate}`;
      const doc = await firestoreService.get(firestorePath);
      if (doc.exists()) {
        await firestoreService.set(firestorePath, {
          blocks: updatedBlocks,
        });
      } else {
        // Seeding the document in Firestore if it didn't exist (e.g. user interacting with mock schedule)
        await firestoreService.set(firestorePath, {
          blocks: updatedBlocks,
          approved: true,
          created_at: new Date().toISOString(),
        });
      }
      console.info(`Updated block index ${blockIndex} to status ${status}`);
    } catch (err) {
      console.error("Error updating block status in Firestore:", err);
    }
  };

  return { schedule, loading, currentMode, toggleMode, dateKey: resolvedDate, updateBlockStatus };
}
