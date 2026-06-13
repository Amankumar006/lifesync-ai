import { useState, useEffect } from "react";
import { firestoreService } from "../services/firebase";

export type TaskItem = {
  id: string;
  title: string;
  type: "assignment" | "exam" | "project" | "reminder";
  due_date: string;
  priority: "critical" | "high" | "medium" | "low";
  completed: boolean;
  subject?: string;
  created_at?: any;
};

export function useTaskQueue(uid: string) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  useEffect(() => {
    if (!uid) return;

    const path = `tasks/${uid}/items`;
    const unsub = firestoreService.onSnapshot(
      path,
      (list: any[]) => {
        // Filter by completed=false and sort by due_date ascending
        const activeTasks = list
          .filter(task => !task.completed)
          .sort((a, b) => {
            const dateA = a.due_date || "";
            const dateB = b.due_date || "";
            return dateA.localeCompare(dateB);
          });
        setTasks(activeTasks);
      },
      (err: any) => {
        console.error("Firestore Task Queue error:", err);
      }
    );

    return unsub;
  }, [uid]);

  return tasks;
}
