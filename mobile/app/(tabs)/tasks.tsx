import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants/colors";
import { firestoreService, authService } from "../../services/firebase";
import { CheckIcon, AddIcon } from "../../components/icons";

export type TaskItem = {
  id: string;
  title: string;
  type: "assignment" | "exam" | "project" | "reminder";
  due_date: string;
  priority: "critical" | "high" | "medium" | "low";
  completed: boolean;
  subject?: string;
  source?: string;
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
    case "high":
      return COLORS.red;
    case "medium":
      return COLORS.yellow;
    case "low":
    default:
      return COLORS.blue;
  }
};

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskItem;
  onToggle: (task: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  const animatedValue = useRef(new Animated.Value(task.completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: task.completed ? 1 : 0,
      duration: 350,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [task.completed]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.98],
  });

  const priorityColor = getPriorityColor(task.priority);

  return (
    <Animated.View style={[styles.taskRow, { opacity, transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[styles.checkCircle, task.completed && styles.checkCircleActive]}
        onPress={() => onToggle(task)}
      >
        {task.completed && (
          <Animated.View style={{ transform: [{ scale: animatedValue }] }}>
            <CheckIcon size={12} color="#15161c" />
          </Animated.View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.taskDetails}
        onLongPress={() => onDelete(task.id)}
      >
        <Text style={[styles.taskName, task.completed && styles.taskNameCompleted]}>
          {task.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <Text style={styles.taskMeta}>
            Due {task.due_date} {task.subject ? `· ${task.subject}` : ""}
          </Text>
          {task.source === "auto_from_lecture" && (
            <View style={styles.lectureBadge}>
              <Text style={styles.lectureBadgeText}>🎙️ from lecture</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={[styles.priorityBadge, { borderColor: priorityColor + "40" }]}>
        <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>
          {task.priority.toUpperCase()}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function TasksScreen() {
  const [uid, setUid] = useState(authService.currentUser?.uid || "mock_user_123");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "today" | "done">("all");

  // Modal form states
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"assignment" | "exam" | "project" | "reminder">("reminder");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"critical" | "high" | "medium" | "low">("medium");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubAuth = authService.onAuthStateChanged((user: any) => {
      if (user) {
        setUid(user.uid);
      } else {
        setUid("mock_user_123");
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const path = `tasks/${uid}/items`;
    const unsub = firestoreService.onSnapshot(
      path,
      (list: any[]) => {
        const mapped = (list || []).map(item => ({
          id: item.id,
          title: item.title || "Untitled Task",
          type: item.type || "reminder",
          due_date: item.due_date || "",
          priority: item.priority || "medium",
          completed: !!item.completed,
          subject: item.subject,
          source: item.source
        }));
        setTasks(mapped);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching tasks:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid]);

  const handleToggleComplete = async (task: TaskItem) => {
    try {
      const docPath = `tasks/${uid}/items/${task.id}`;
      await firestoreService.update(docPath, { completed: !task.completed });
    } catch (err: any) {
      Alert.alert("Error", `Failed to update task: ${err.message}`);
    }
  };

  const handleCreateTask = async () => {
    if (!title.trim() || !dueDate.trim()) {
      Alert.alert("Error", "Please fill in title and due date.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      Alert.alert("Error", "Due date must be in YYYY-MM-DD format.");
      return;
    }

    setSaving(true);
    try {
      const colPath = `tasks/${uid}/items`;
      await firestoreService.add(colPath, {
        title: title.trim(),
        type,
        due_date: dueDate.trim(),
        priority,
        completed: false,
        subject: subject.trim() || undefined,
        created_at: new Date().toISOString()
      });
      
      setTitle("");
      setDueDate("");
      setSubject("");
      setType("reminder");
      setPriority("medium");
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", `Failed to create task: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await firestoreService.delete(`tasks/${uid}/items/${taskId}`);
          } catch (err: any) {
            Alert.alert("Error", `Failed to delete task: ${err.message}`);
          }
        }
      }
    ]);
  };

  // Filter logic
  const todayStr = new Date().toISOString().split("T")[0];
  const filteredTasks = tasks.filter(t => {
    if (filter === "done") return t.completed;
    if (filter === "today") return !t.completed && t.due_date === todayStr;
    return true; // "all"
  });

  // Grouping logic (for Active/Incomplete tasks when filter is not "done")
  const urgentTasks = filteredTasks.filter(t => !t.completed && (t.priority === "critical" || t.priority === "high"));
  const regularTasks = filteredTasks.filter(t => !t.completed && t.priority !== "critical" && t.priority !== "high");
  const completedTasks = filteredTasks.filter(t => t.completed);



  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
      </View>

      {/* FILTER ROW */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, filter === "all" && styles.filterPillActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterPillText, filter === "all" && styles.filterPillTextActive]}>
            All · {tasks.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, filter === "today" && styles.filterPillActive]}
          onPress={() => setFilter("today")}
        >
          <Text style={[styles.filterPillText, filter === "today" && styles.filterPillTextActive]}>
            Today · {tasks.filter(t => !t.completed && t.due_date === todayStr).length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, filter === "done" && styles.filterPillActive]}
          onPress={() => setFilter("done")}
        >
          <Text style={[styles.filterPillText, filter === "done" && styles.filterPillTextActive]}>
            Done · {tasks.filter(t => t.completed).length}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {filter !== "done" && urgentTasks.length > 0 && (
            <>
              <Text style={styles.groupLabel}>Urgent</Text>
              {urgentTasks.map(t => (
                <TaskRow key={t.id} task={t} onToggle={handleToggleComplete} onDelete={handleDeleteTask} />
              ))}
            </>
          )}

          {filter !== "done" && regularTasks.length > 0 && (
            <>
              <Text style={styles.groupLabel}>Upcoming</Text>
              {regularTasks.map(t => (
                <TaskRow key={t.id} task={t} onToggle={handleToggleComplete} onDelete={handleDeleteTask} />
              ))}
            </>
          )}

          {filter !== "today" && completedTasks.length > 0 && (
            <>
              <Text style={styles.groupLabel}>Completed</Text>
              <View style={styles.completedGroup}>
                {completedTasks.map(t => (
                  <TaskRow key={t.id} task={t} onToggle={handleToggleComplete} onDelete={handleDeleteTask} />
                ))}
              </View>
            </>
          )}

          {filteredTasks.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tasks found</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* FLOATING ACTION BUTTON */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <AddIcon size={20} color="#15161c" />
      </TouchableOpacity>

      {/* CREATE TASK MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Add Task</Text>
            <ScrollView style={{ width: "100%" }}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Buy Lab Manual"
                  placeholderTextColor={COLORS.textDim}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.formLabel}>Subject (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="e.g. Physics"
                    placeholderTextColor={COLORS.textDim}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Due Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.textDim}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Task Type</Text>
                <View style={styles.selectorRow}>
                  {(["assignment", "exam", "project", "reminder"] as const).map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.selectorButton, type === item && styles.selectorActive]}
                      onPress={() => setType(item)}
                    >
                      <Text style={[styles.selectorText, type === item && styles.selectorTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Priority</Text>
                <View style={styles.selectorRow}>
                  {(["critical", "high", "medium", "low"] as const).map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.selectorButton, priority === item && styles.selectorActive]}
                      onPress={() => setPriority(item)}
                    >
                      <Text style={[styles.selectorText, priority === item && styles.selectorTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateTask}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#15161c" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Task</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );


}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: "center",
  },
  filterPillActive: {
    backgroundColor: COLORS.accentBg,
    borderColor: COLORS.accentLine,
  },
  filterPillText: {
    fontSize: 12,
    color: COLORS.textDim,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: COLORS.accent,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  completedGroup: {
    opacity: 0.6,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkCircleActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  taskDetails: {
    flex: 1,
  },
  taskName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  taskNameCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.textDim,
  },
  taskMeta: {
    fontSize: 11,
    color: COLORS.textDim,
    marginTop: 2,
  },
  priorityBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.textDim,
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    maxHeight: "85%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 16,
  },
  formGroup: {
    width: "100%",
    marginBottom: 16,
  },
  formRow: {
    flexDirection: "row",
    width: "100%",
  },
  formLabel: {
    fontSize: 11,
    color: COLORS.textDim,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
    fontFamily: "monospace",
  },
  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  selectorButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  selectorActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentBg,
  },
  selectorText: {
    fontSize: 12,
    color: COLORS.textDim,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  selectorTextActive: {
    color: COLORS.accent,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#15161c",
    fontWeight: "700",
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  lectureBadge: {
    backgroundColor: "rgba(110,231,168,0.1)",
    borderWidth: 1,
    borderColor: "rgba(110,231,168,0.2)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  lectureBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: COLORS.green,
  },
});
