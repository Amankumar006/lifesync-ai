import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView
} from "react-native";
import { COLORS } from "../../constants/colors";
import { firestoreService, authService } from "../../services/firebase";

type Unit = {
  number: number;
  title: string;
  topics: string[];
  status: "not_started" | "in_progress" | "completed";
  completion_percent: number;
  weightage?: string;
};

type SubjectSyllabus = {
  id: string;
  subject: string;
  scheme?: string;
  credits?: number;
  units: Unit[];
};

export default function SyllabusScreen() {
  const [uid, setUid] = useState(authService.currentUser?.uid || "mock_user_123");
  const [subjects, setSubjects] = useState<SubjectSyllabus[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded subjects state
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Subject manual creation form
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectScheme, setNewSubjectScheme] = useState("VTU 2022");
  const [creatingSubject, setCreatingSubject] = useState(false);

  // Editing Unit title
  const [editingUnitKey, setEditingUnitKey] = useState<{ subjectId: string; unitNum: number } | null>(null);
  const [editingUnitTitle, setEditingUnitTitle] = useState("");

  // New topic form
  const [newTopicTexts, setNewTopicTexts] = useState<Record<string, string>>({}); // keyed by subjectId_unitNum

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
    if (!uid) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const colPath = `syllabus/${uid}/subjects`;
    const unsub = firestoreService.onSnapshot(
      colPath,
      (list: any[]) => {
        setSubjects(list || []);
        setLoading(false);
      },
      (err: any) => {
        console.error("Error fetching syllabus:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid]);

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }));
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) {
      Alert.alert("Error", "Please enter a subject name.");
      return;
    }

    setCreatingSubject(true);
    try {
      // Default to 5 Units
      const defaultUnits: Unit[] = Array.from({ length: 5 }, (_, idx) => ({
        number: idx + 1,
        title: `Module ${idx + 1}`,
        topics: [],
        status: "not_started",
        completion_percent: 0
      }));

      const docPath = `syllabus/${uid}/subjects/${newSubjectName.trim()}`;
      await firestoreService.set(docPath, {
        subject: newSubjectName.trim(),
        scheme: newSubjectScheme.trim(),
        units: defaultUnits
      });

      setNewSubjectName("");
      setNewSubjectScheme("VTU 2022");
      setShowAddSubject(false);
      Alert.alert("Success", `Subject '${newSubjectName.trim()}' added!`);
    } catch (err: any) {
      Alert.alert("Error", `Failed to add subject: ${err.message}`);
    } finally {
      setCreatingSubject(false);
    }
  };

  const handleDeleteSubject = (subjectId: string) => {
    Alert.alert(
      "Remove Subject",
      `Are you sure you want to delete '${subjectId}' syllabus progress?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await firestoreService.delete(`syllabus/${uid}/subjects/${subjectId}`);
            } catch (err: any) {
              Alert.alert("Error", `Failed to remove: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  const handleAddUnit = async (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const nextNum = subject.units.length > 0 ? Math.max(...subject.units.map(u => u.number)) + 1 : 1;
    const newUnit: Unit = {
      number: nextNum,
      title: `Module ${nextNum}`,
      topics: [],
      status: "not_started",
      completion_percent: 0
    };

    const updatedUnits = [...subject.units, newUnit];
    try {
      await firestoreService.set(`syllabus/${uid}/subjects/${subjectId}`, {
        ...subject,
        units: updatedUnits
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleRemoveUnit = async (subjectId: string, unitNum: number) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    Alert.alert(
      "Remove Unit",
      `Are you sure you want to delete Unit ${unitNum}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedUnits = subject.units.filter(u => u.number !== unitNum);
            try {
              await firestoreService.set(`syllabus/${uid}/subjects/${subjectId}`, {
                ...subject,
                units: updatedUnits
              });
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const updateUnitField = async (
    subjectId: string,
    unitNum: number,
    field: "title" | "status" | "completion_percent",
    value: any
  ) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const updatedUnits = subject.units.map(unit => {
      if (unit.number === unitNum) {
        let updated = { ...unit };
        if (field === "title") {
          updated.title = value;
        } else if (field === "status") {
          updated.status = value;
          if (value === "completed") {
            updated.completion_percent = 100;
          } else if (value === "not_started") {
            updated.completion_percent = 0;
          }
        } else if (field === "completion_percent") {
          const val = Math.max(0, Math.min(100, value));
          updated.completion_percent = val;
          if (val === 100) {
            updated.status = "completed";
          } else if (val > 0) {
            updated.status = "in_progress";
          } else {
            updated.status = "not_started";
          }
        }
        return updated;
      }
      return unit;
    });

    try {
      await firestoreService.set(`syllabus/${uid}/subjects/${subjectId}`, {
        ...subject,
        units: updatedUnits
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const startEditingUnitTitle = (subjectId: string, unit: Unit) => {
    setEditingUnitKey({ subjectId, unitNum: unit.number });
    setEditingUnitTitle(unit.title);
  };

  const saveUnitTitle = async (subjectId: string, unitNum: number) => {
    if (!editingUnitTitle.trim()) {
      Alert.alert("Error", "Title cannot be empty.");
      return;
    }
    await updateUnitField(subjectId, unitNum, "title", editingUnitTitle.trim());
    setEditingUnitKey(null);
  };

  const handleAddTopic = async (subjectId: string, unitNum: number) => {
    const key = `${subjectId}_${unitNum}`;
    const topicText = newTopicTexts[key] || "";
    if (!topicText.trim()) return;

    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const updatedUnits = subject.units.map(unit => {
      if (unit.number === unitNum) {
        return {
          ...unit,
          topics: [...unit.topics, topicText.trim()]
        };
      }
      return unit;
    });

    try {
      await firestoreService.set(`syllabus/${uid}/subjects/${subjectId}`, {
        ...subject,
        units: updatedUnits
      });
      setNewTopicTexts(prev => ({ ...prev, [key]: "" }));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleRemoveTopic = async (subjectId: string, unitNum: number, topicIdx: number) => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const updatedUnits = subject.units.map(unit => {
      if (unit.number === unitNum) {
        return {
          ...unit,
          topics: unit.topics.filter((_, idx) => idx !== topicIdx)
        };
      }
      return unit;
    });

    try {
      await firestoreService.set(`syllabus/${uid}/subjects/${subjectId}`, {
        ...subject,
        units: updatedUnits
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const calculateSubjectProgress = (units: Unit[]) => {
    if (!units || units.length === 0) return 0;
    const sum = units.reduce((acc, u) => acc + u.completion_percent, 0);
    return Math.round(sum / units.length);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* HEADER SECTION */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionLabel}>📚 Track Course Progress</Text>
          <TouchableOpacity
            style={styles.addSubjectBtn}
            onPress={() => setShowAddSubject(!showAddSubject)}
          >
            <Text style={styles.addSubjectBtnText}>
              {showAddSubject ? "Close" : "+ Add Subject"}
            </Text>
          </TouchableOpacity>
        </View>

        {showAddSubject && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Add Subject Tracker</Text>
            <View style={styles.formInputGroup}>
              <Text style={styles.inputLabel}>Subject Name</Text>
              <TextInput
                style={styles.textInput}
                value={newSubjectName}
                onChangeText={setNewSubjectName}
                placeholder="e.g. Operating Systems"
                placeholderTextColor={COLORS.muted}
              />
            </View>
            <View style={styles.formInputGroup}>
              <Text style={styles.inputLabel}>Syllabus Scheme</Text>
              <TextInput
                style={styles.textInput}
                value={newSubjectScheme}
                onChangeText={setNewSubjectScheme}
                placeholder="e.g. VTU 2022"
                placeholderTextColor={COLORS.muted}
              />
            </View>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddSubject}
              disabled={creatingSubject}
            >
              {creatingSubject ? (
                <ActivityIndicator size="small" color="#0c0e14" />
              ) : (
                <Text style={styles.submitBtnText}>Create Tracker</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* LIST OF TRACKERS */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : subjects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No subject syllabus being tracked yet. Upload a syllabus PDF in the Academics tab or add a custom subject tracker above.</Text>
          </View>
        ) : (
          subjects.map(subject => {
            const isExpanded = !!expandedSubjects[subject.id];
            const avgProgress = calculateSubjectProgress(subject.units);
            
            return (
              <View key={subject.id} style={styles.subjectCard}>
                {/* Subject Title Card */}
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggleSubject(subject.id)}
                >
                  <View style={styles.headerInfoCol}>
                    <Text style={styles.subjectTitle}>{subject.subject}</Text>
                    <Text style={styles.subjectScheme}>{subject.scheme || "Syllabus Plan"} • {subject.units.length} Modules</Text>
                  </View>
                  <View style={styles.headerProgressCol}>
                    <Text style={styles.progressPctText}>{avgProgress}%</Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${avgProgress}%` }]} />
                    </View>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.cardDetails}>
                    <View style={styles.cardActionsHeader}>
                      <TouchableOpacity
                        style={styles.actionBtnSecondary}
                        onPress={() => handleAddUnit(subject.id)}
                      >
                        <Text style={styles.actionBtnText}>+ Add Unit/Module</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteSubjectBtn}
                        onPress={() => handleDeleteSubject(subject.id)}
                      >
                        <Text style={styles.deleteSubjectBtnText}>Delete Subject</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Units list */}
                    {subject.units.map(unit => {
                      const isEditingTitle = editingUnitKey?.subjectId === subject.id && editingUnitKey?.unitNum === unit.number;
                      const topicKey = `${subject.id}_${unit.number}`;
                      const currentTopicText = newTopicTexts[topicKey] || "";
                      
                      return (
                        <View key={unit.number} style={styles.unitItem}>
                          {/* Unit Title and Edit */}
                          <View style={styles.unitHeaderRow}>
                            {isEditingTitle ? (
                              <View style={styles.editTitleRow}>
                                <TextInput
                                  style={styles.editTitleInput}
                                  value={editingUnitTitle}
                                  onChangeText={setEditingUnitTitle}
                                />
                                <TouchableOpacity
                                  style={styles.saveTitleBtn}
                                  onPress={() => saveUnitTitle(subject.id, unit.number)}
                                >
                                  <Text style={styles.saveTitleBtnText}>✓</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.unitTitleBtn}
                                onPress={() => startEditingUnitTitle(subject.id, unit)}
                              >
                                <Text style={styles.unitTitleText}>
                                  Module {unit.number}: {unit.title} 📝
                                </Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              onPress={() => handleRemoveUnit(subject.id, unit.number)}
                              style={styles.removeUnitBtn}
                            >
                              <Text style={styles.removeUnitText}>✕</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Completion Percent Control */}
                          <View style={styles.progressControlRow}>
                            <Text style={styles.progressLabel}>Completion:</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <TouchableOpacity
                                style={styles.adjustBtn}
                                onPress={() => updateUnitField(subject.id, unit.number, "completion_percent", unit.completion_percent - 10)}
                              >
                                <Text style={styles.adjustBtnText}>-10%</Text>
                              </TouchableOpacity>
                              
                              <TextInput
                                style={{
                                  backgroundColor: COLORS.bg,
                                  color: COLORS.accent,
                                  borderWidth: 1,
                                  borderColor: COLORS.border,
                                  borderRadius: 6,
                                  width: 40,
                                  height: 28,
                                  textAlign: "center",
                                  fontSize: 11,
                                  fontWeight: "700",
                                  padding: 0
                                }}
                                keyboardType="numeric"
                                value={String(unit.completion_percent)}
                                onChangeText={(text) => {
                                  const val = parseInt(text.trim(), 10);
                                  if (!isNaN(val)) {
                                    updateUnitField(subject.id, unit.number, "completion_percent", val);
                                  } else if (text.trim() === "") {
                                    updateUnitField(subject.id, unit.number, "completion_percent", 0);
                                  }
                                }}
                              />
                              <Text style={{ color: COLORS.accent, fontSize: 11, fontWeight: "700", marginRight: 4 }}>%</Text>

                              <TouchableOpacity
                                style={styles.adjustBtn}
                                onPress={() => updateUnitField(subject.id, unit.number, "completion_percent", unit.completion_percent + 10)}
                              >
                                <Text style={styles.adjustBtnText}>+10%</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Status buttons */}
                          <View style={styles.statusRow}>
                            {["not_started", "in_progress", "completed"].map(st => {
                              const isActive = unit.status === st;
                              let label = "NOT STARTED";
                              let activeBg = "rgba(90, 96, 128, 0.15)";
                              let activeText = COLORS.muted;
                              
                              if (st === "in_progress") {
                                label = "IN PROGRESS";
                                activeBg = "rgba(196, 122, 255, 0.15)";
                                activeText = "#c47aff";
                              } else if (st === "completed") {
                                label = "COMPLETED";
                                activeBg = "rgba(0, 229, 160, 0.15)";
                                activeText = COLORS.accent;
                              }

                              return (
                                <TouchableOpacity
                                  key={st}
                                  style={[
                                    styles.statusBtn,
                                    isActive && { backgroundColor: activeBg, borderColor: activeText }
                                  ]}
                                  onPress={() => updateUnitField(subject.id, unit.number, "status", st)}
                                >
                                  <Text style={[styles.statusBtnText, isActive && { color: activeText }]}>
                                    {label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {/* Topics Section */}
                          <View style={styles.topicsSection}>
                            <Text style={styles.topicsHeading}>Syllabus Topics ({unit.topics?.length || 0})</Text>
                            {unit.topics && unit.topics.map((topic, tIdx) => (
                              <View key={tIdx} style={styles.topicRow}>
                                <Text style={styles.topicBullet}>•</Text>
                                <Text style={styles.topicText}>{topic}</Text>
                                <TouchableOpacity
                                  style={styles.removeTopicBtn}
                                  onPress={() => handleRemoveTopic(subject.id, unit.number, tIdx)}
                                >
                                  <Text style={styles.removeTopicBtnText}>✕</Text>
                                </TouchableOpacity>
                              </View>
                            ))}

                            {/* Add Topic Input */}
                            <View style={styles.addTopicRow}>
                              <TextInput
                                style={styles.addTopicInput}
                                value={currentTopicText}
                                onChangeText={(val) => setNewTopicTexts(prev => ({ ...prev, [topicKey]: val }))}
                                placeholder="Add key topic..."
                                placeholderTextColor={COLORS.muted}
                              />
                              <TouchableOpacity
                                style={styles.addTopicBtn}
                                onPress={() => handleAddTopic(subject.id, unit.number)}
                              >
                                <Text style={styles.addTopicBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace"
  },
  addSubjectBtn: {
    backgroundColor: "rgba(0, 229, 160, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  addSubjectBtnText: {
    color: COLORS.accent,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "700"
  },
  addForm: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20
  },
  formTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12
  },
  formInputGroup: {
    marginBottom: 12
  },
  inputLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: "monospace",
    marginBottom: 6
  },
  textInput: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: "monospace"
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8
  },
  submitBtnText: {
    color: "#0c0e14",
    fontSize: 12,
    fontWeight: "700"
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 24,
    alignItems: "center"
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  subjectCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden"
  },
  cardHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerInfoCol: {
    flex: 1.5,
    marginRight: 10
  },
  subjectTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700"
  },
  subjectScheme: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: "monospace"
  },
  headerProgressCol: {
    flex: 1,
    alignItems: "flex-end"
  },
  progressPctText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
    marginBottom: 4
  },
  progressBarBg: {
    width: "100%",
    height: 4,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    backgroundColor: "rgba(15, 17, 24, 0.4)"
  },
  cardActionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  actionBtnSecondary: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  actionBtnText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "600"
  },
  deleteSubjectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  deleteSubjectBtnText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: "700"
  },
  unitItem: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  unitHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  unitTitleBtn: {
    flex: 1
  },
  unitTitleText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700"
  },
  removeUnitBtn: {
    padding: 4,
    marginLeft: 8
  },
  removeUnitText: {
    color: COLORS.muted,
    fontSize: 12
  },
  editTitleRow: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  editTitleInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12
  },
  saveTitleBtn: {
    backgroundColor: "rgba(0, 229, 160, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center"
  },
  saveTitleBtnText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700"
  },
  progressControlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 8
  },
  progressLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontFamily: "monospace"
  },
  progressBtnGroup: {
    flexDirection: "row",
    gap: 8
  },
  adjustBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.bg
  },
  adjustBtnText: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700"
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16
  },
  statusBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: COLORS.surface
  },
  statusBtnText: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700"
  },
  topicsSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10
  },
  topicsHeading: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
    marginBottom: 8
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingLeft: 4
  },
  topicBullet: {
    color: COLORS.accent,
    fontSize: 14,
    marginRight: 6
  },
  topicText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 11
  },
  removeTopicBtn: {
    padding: 4
  },
  removeTopicBtnText: {
    color: COLORS.muted,
    fontSize: 10
  },
  addTopicRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8
  },
  addTopicInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11
  },
  addTopicBtn: {
    backgroundColor: "rgba(0, 229, 160, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center"
  },
  addTopicBtnText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700"
  }
});
