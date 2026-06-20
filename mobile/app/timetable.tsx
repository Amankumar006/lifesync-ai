import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/colors";
import { firestoreService, authService } from "../services/firebase";

type ClassBlock = {
  time: string;
  subject: string;
  room?: string;
  textbooks?: string[];
};

type Timetable = Record<string, ClassBlock[]>;

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export default function TimetableScreen() {
  const router = useRouter();
  const [uid, setUid] = useState(authService.currentUser?.uid || "mock_user_123");

  const [selectedDay, setSelectedDay] = useState("Monday");
  const [timetable, setTimetable] = useState<Timetable>({
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: []
  });

  // Form states for adding a new class
  const [subject, setSubject] = useState("");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState("");
  const [textbooks, setTextbooks] = useState("");
  const [loading, setLoading] = useState(false);

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
    const docPath = `timetables/${uid}`;
    const unsub = firestoreService.onSnapshot(docPath, (doc: any) => {
      if (doc.exists && doc.data()) {
        const data = doc.data();
        const merged: Timetable = {
          Monday: data.Monday || [],
          Tuesday: data.Tuesday || [],
          Wednesday: data.Wednesday || [],
          Thursday: data.Thursday || [],
          Friday: data.Friday || [],
          Saturday: data.Saturday || [],
          Sunday: data.Sunday || []
        };
        setTimetable(merged);
      }
    });

    return unsub;
  }, [uid]);

  const addClass = () => {
    if (!subject || !time) {
      Alert.alert("Error", "Please fill in both Subject and Time fields.");
      return;
    }

    const newClass: ClassBlock = {
      subject,
      time,
      room: room || undefined,
      textbooks: textbooks ? textbooks.split(",").map(t => t.trim()).filter(Boolean) : undefined
    };

    const updatedClasses = [...(timetable[selectedDay] || []), newClass];
    // Sort classes by time
    updatedClasses.sort((a, b) => a.time.localeCompare(b.time));

    setTimetable(prev => ({
      ...prev,
      [selectedDay]: updatedClasses
    }));

    // Reset form fields
    setSubject("");
    setTime("");
    setRoom("");
    setTextbooks("");
  };

  const deleteClass = (index: number) => {
    const updatedClasses = (timetable[selectedDay] || []).filter((_, idx) => idx !== index);
    setTimetable(prev => ({
      ...prev,
      [selectedDay]: updatedClasses
    }));
  };

  const saveToFirestore = async () => {
    setLoading(true);
    try {
      const docPath = `timetables/${uid}`;
      await firestoreService.set(docPath, timetable);
      Alert.alert("Success", "Timetable saved and synced to Firestore!");
    } catch (e: any) {
      Alert.alert("Error", `Failed to save timetable: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Day Selector */}
        <Text style={styles.sectionLabel}>📅 Select Day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelectorContainer}>
          {DAYS.map(day => {
            const isSelected = day === selectedDay;
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, isSelected && styles.selectedDayButton]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayButtonText, isSelected && styles.selectedDayButtonText]}>
                  {day.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Classes List */}
        <Text style={styles.sectionLabel}>🎓 Classes for {selectedDay}</Text>
        <View style={styles.listContainer}>
          {(!timetable[selectedDay] || timetable[selectedDay].length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No classes scheduled for {selectedDay}.</Text>
            </View>
          ) : (
            timetable[selectedDay].map((cls, idx) => (
              <View key={idx} style={styles.classCard}>
                <View style={styles.classHeader}>
                  <Text style={styles.classTime}>🕒 {cls.time}</Text>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => deleteClass(idx)}>
                    <Text style={styles.deleteButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.classSubject}>{cls.subject}</Text>
                {cls.room ? <Text style={styles.classRoom}>📍 Room: {cls.room}</Text> : null}
                {cls.textbooks && cls.textbooks.length > 0 ? (
                  <Text style={styles.classBooks}>📖 Books: {cls.textbooks.join(", ")}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Add Class Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>➕ Add New Class</Text>
          
          <Text style={styles.inputLabel}>Subject / Class Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Computer Science"
            placeholderTextColor={COLORS.muted}
            value={subject}
            onChangeText={setSubject}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.inputLabel}>Start Time * (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 09:00"
                placeholderTextColor={COLORS.muted}
                value={time}
                onChangeText={setTime}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.inputLabel}>Room No. (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. A302"
                placeholderTextColor={COLORS.muted}
                value={room}
                onChangeText={setRoom}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Textbooks (Optional, comma separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Intro to Algorithms, CLRS"
            placeholderTextColor={COLORS.muted}
            value={textbooks}
            onChangeText={setTextbooks}
          />

          <TouchableOpacity style={styles.addButton} onPress={addClass}>
            <Text style={styles.addButtonText}>Add to List</Text>
          </TouchableOpacity>
        </View>

        {/* Sync/Save Action */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledSaveButton]}
          onPress={saveToFirestore}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? "Syncing..." : "💾 Save & Sync all to Firestore"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  daySelectorContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  dayButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  selectedDayButton: {
    backgroundColor: COLORS.accentBg,
    borderColor: COLORS.accentLine,
    borderWidth: 1,
  },
  dayButtonText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  selectedDayButtonText: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  listContainer: {
    marginBottom: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.textDim,
    fontSize: 13,
  },
  classCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  classHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  classTime: {
    color: COLORS.accent,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 138, 155, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 138, 155, 0.2)",
  },
  deleteButtonText: {
    color: COLORS.red,
    fontSize: 10,
    fontWeight: "700",
  },
  classSubject: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
  },
  classRoom: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  classBooks: {
    color: COLORS.textDim,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  inputLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    width: "48%",
  },
  addButton: {
    backgroundColor: COLORS.accentBg,
    borderWidth: 1,
    borderColor: COLORS.accentLine,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  disabledSaveButton: {
    backgroundColor: COLORS.textDim,
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#15161c",
    fontWeight: "700",
    fontSize: 14,
  }
});
