import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS, TYPE_COLORS } from "../../constants/colors";
import { firestoreService, authService } from "../../services/firebase";
import * as Location from "expo-location";
import { mockTriggerGeofence } from "../../hooks/useGeofence";

interface LocationCoords {
  latitude: number;
  longitude: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  
  // Coordinates state
  const [gymCoords, setGymCoords] = useState<LocationCoords | null>(null);
  const [collegeCoords, setCollegeCoords] = useState<LocationCoords | null>(null);
  const [homeCoords, setHomeCoords] = useState<LocationCoords | null>(null);

  // Input fields state (for manual coordinate adjustment)
  const [gymLat, setGymLat] = useState("");
  const [gymLon, setGymLon] = useState("");
  const [collegeLat, setCollegeLat] = useState("");
  const [collegeLon, setCollegeLon] = useState("");
  const [homeLat, setHomeLat] = useState("");
  const [homeLon, setHomeLon] = useState("");

  // Fixed blocks state
  const [fixedBlocks, setFixedBlocks] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newType, setNewType] = useState("personal");
  const [newDays, setNewDays] = useState<string[]>([]);

  const [authUser, setAuthUser] = useState<any>(authService.currentUser);
  const user = authUser;

  useEffect(() => {
    const unsubAuth = authService.onAuthStateChanged((user: any) => {
      setAuthUser(user);
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    let unsubLocs: (() => void) | undefined;
    let unsubBlocks: (() => void) | undefined;

    if (authUser) {
      setEmail(authUser.email || "Anonymous Demo");
      setUid(authUser.uid);
      unsubLocs = loadSavedLocations(authUser.uid);
      unsubBlocks = loadFixedBlocks(authUser.uid);
    } else {
      setUid("mock_user_123");
      setEmail("demo@agentcopilot.ai");
      unsubLocs = loadSavedLocations("mock_user_123");
      unsubBlocks = loadFixedBlocks("mock_user_123");
    }

    return () => {
      if (unsubLocs) unsubLocs();
      if (unsubBlocks) unsubBlocks();
    };
  }, [authUser]);

  const loadSavedLocations = (userId: string) => {
    const docPath = `users/${userId}`;
    const unsub = firestoreService.onSnapshot(
      docPath,
      (doc: any) => {
        if (doc?.exists()) {
          const data = doc.data();
          const locs = data?.locations || {};
          
          if (locs.gym) {
            setGymCoords(locs.gym);
            setGymLat(locs.gym.latitude.toString());
            setGymLon(locs.gym.longitude.toString());
          }
          if (locs.college) {
            setCollegeCoords(locs.college);
            setCollegeLat(locs.college.latitude.toString());
            setCollegeLon(locs.college.longitude.toString());
          }
          if (locs.home) {
            setHomeCoords(locs.home);
            setHomeLat(locs.home.latitude.toString());
            setHomeLon(locs.home.longitude.toString());
          }
        }
        setLoading(false);
      },
      (err: any) => {
        console.error("Error loading user profile locations:", err);
        setLoading(false);
      }
    );
    return unsub;
  };

  const loadFixedBlocks = (userId: string) => {
    const docPath = `personal_schedule/${userId}`;
    const unsub = firestoreService.onSnapshot(
      docPath,
      (doc: any) => {
        if (doc?.exists()) {
          const data = doc.data();
          setFixedBlocks(data?.fixed_blocks || []);
        } else {
          setFixedBlocks([]);
        }
      },
      (err: any) => {
        console.error("Error loading fixed blocks:", err);
      }
    );
    return unsub;
  };

  const toggleDay = (day: string) => {
    if (newDays.includes(day)) {
      setNewDays(newDays.filter(d => d !== day));
    } else {
      setNewDays([...newDays, day]);
    }
  };

  const handleAddFixedBlock = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Error", "Please enter a title.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(newTime.trim())) {
      Alert.alert("Error", "Please enter a valid time in HH:MM format (e.g. 07:30 or 19:15).");
      return;
    }
    if (newDays.length === 0) {
      Alert.alert("Error", "Please select at least one day.");
      return;
    }

    const newBlock = {
      title: newTitle.trim(),
      time: newTime.trim(),
      type: newType,
      days: newDays,
    };

    const updatedBlocks = [...fixedBlocks, newBlock];

    try {
      await firestoreService.set(`personal_schedule/${uid}`, {
        fixed_blocks: updatedBlocks,
      });
      setNewTitle("");
      setNewTime("");
      setNewType("personal");
      setNewDays([]);
      setShowAddForm(false);
      Alert.alert("Success", "Fixed schedule block added!");
    } catch (err: any) {
      console.error("Error saving fixed block:", err);
      Alert.alert("Error", "Could not save the fixed block to database.");
    }
  };

  const handleDeleteFixedBlock = async (indexToDelete: number) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this routine block?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = fixedBlocks.filter((_, idx) => idx !== indexToDelete);
            try {
              await firestoreService.set(`personal_schedule/${uid}`, {
                fixed_blocks: updated,
              });
            } catch (err) {
              console.error("Error deleting fixed block:", err);
              Alert.alert("Error", "Could not delete fixed block.");
            }
          }
        }
      ]
    );
  };

  const handleGetCurrentLocation = async (type: "gym" | "college" | "home") => {
    try {
      const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
      if (foreStatus !== "granted") {
        Alert.alert("Permission Required", "Foreground location permission is needed to fetch current coordinates.");
        return;
      }

      setSaving(type);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      if (type === "gym") {
        setGymLat(coords.latitude.toString());
        setGymLon(coords.longitude.toString());
      } else if (type === "college") {
        setCollegeLat(coords.latitude.toString());
        setCollegeLon(coords.longitude.toString());
      } else if (type === "home") {
        setHomeLat(coords.latitude.toString());
        setHomeLon(coords.longitude.toString());
      }

      Alert.alert("Location Fetched", `Fetched current coordinates for ${type}. Make sure to click Save.`);
    } catch (err: any) {
      console.error("Error getting location:", err);
      Alert.alert("Error", "Could not fetch current coordinates. Ensure GPS is enabled.");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveLocation = async (type: "gym" | "college" | "home") => {
    if (!user) return;
    
    let latStr = "";
    let lonStr = "";
    if (type === "gym") {
      latStr = gymLat;
      lonStr = gymLon;
    } else if (type === "college") {
      latStr = collegeLat;
      lonStr = collegeLon;
    } else if (type === "home") {
      latStr = homeLat;
      lonStr = homeLon;
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert("Invalid Coordinates", "Please enter valid numeric values for latitude and longitude.");
      return;
    }

    setSaving(type);
    try {
      // Build location update payload
      const locData = { latitude: lat, longitude: lon };
      
      // Load current user doc first to avoid overwriting existing fields
      const currentDoc = await firestoreService.get(`users/${user.uid}`);
      const currentLocs = currentDoc.exists() ? currentDoc.data()?.locations || {} : {};
      
      const newLocs = {
        ...currentLocs,
        [type]: locData,
      };

      await firestoreService.set(`users/${user.uid}`, {
        locations: newLocs,
      });

      Alert.alert("Saved Successfully", `${type.toUpperCase()} location is now set and monitored.`);
    } catch (err: any) {
      console.error("Error saving location:", err);
      Alert.alert("Save Failed", err.message || "Could not write coordinates to database.");
    } finally {
      setSaving(null);
    }
  };

  const handleMockTrigger = async (type: "gym" | "college" | "home") => {
    try {
      Alert.alert(
        "Mock Geofence Trigger",
        `Do you want to simulate entering the ${type.toUpperCase()} geofence? This will notify your AI agent immediately.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Trigger",
            onPress: async () => {
              await mockTriggerGeofence(type);
              Alert.alert("Trigger Sent", `Simulated arrival at the ${type} sent to backend.`);
            },
          },
        ]
      );
    } catch (err) {
      console.error("Mock geofence trigger error:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to sign out");
    }
  };

  const [activeLocationCard, setActiveLocationCard] = useState<"gym" | "college" | "home" | null>(null);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{email[0]?.toUpperCase() || "U"}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.emailText}>{email}</Text>
            <Text style={styles.uidText} numberOfLines={1}>UID: {uid}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>📍 Contextual Geofencing</Text>
        <Text style={styles.sectionSubtitle}>
          Define geographical coordinates for Gym, College, and Home. Your agent will dynamically adapt schedules and send contextual reminders as you arrive.
        </Text>

        {/* GYM CARD */}
        <View style={styles.locationCard}>
          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => setActiveLocationCard(activeLocationCard === "gym" ? null : "gym")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🏋️</Text>
              <Text style={styles.cardTitle}>Gym Location</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {gymCoords ? (
                <Text style={[styles.statusBadge, styles.activeBadge]}>Monitored</Text>
              ) : (
                <Text style={[styles.statusBadge, styles.inactiveBadge]}>Not Set</Text>
              )}
              <Text style={{ color: COLORS.accent, fontSize: 10 }}>
                {activeLocationCard === "gym" ? "▲" : "▼"}
              </Text>
            </View>
          </TouchableOpacity>
          
          {activeLocationCard === "gym" ? (
            <View style={{ marginTop: 12 }}>
              <View style={styles.coordsDisplayRow}>
                <Text style={styles.coordsLabel}>Saved: </Text>
                <Text style={styles.coordsValue}>
                  {gymCoords ? `${gymCoords.latitude.toFixed(6)}, ${gymCoords.longitude.toFixed(6)}` : "Not configured yet"}
                </Text>
              </View>

              <View style={styles.inputsRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Latitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={gymLat}
                    onChangeText={setGymLat}
                    placeholder="e.g. 37.7749"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Longitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={gymLon}
                    onChangeText={setGymLon}
                    placeholder="e.g. -122.4194"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.cardButtonSecondary}
                  onPress={() => handleGetCurrentLocation("gym")}
                  disabled={saving !== null}
                >
                  <Text style={styles.buttonSecondaryText}>GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardButtonPrimary}
                  onPress={() => handleSaveLocation("gym")}
                  disabled={saving !== null}
                >
                  {saving === "gym" ? (
                    <ActivityIndicator size="small" color="#15161c" />
                  ) : (
                    <Text style={styles.buttonPrimaryText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardButtonAccent, !gymCoords && styles.buttonDisabled]}
                  onPress={() => handleMockTrigger("gym")}
                  disabled={!gymCoords}
                >
                  <Text style={styles.buttonAccentText}>Mock Arrival</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            gymCoords && (
              <Text style={styles.collapsedCoordsText}>
                Saved: {gymCoords.latitude.toFixed(4)}, {gymCoords.longitude.toFixed(4)}
              </Text>
            )
          )}
        </View>

        {/* COLLEGE CARD */}
        <View style={styles.locationCard}>
          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => setActiveLocationCard(activeLocationCard === "college" ? null : "college")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🎓</Text>
              <Text style={styles.cardTitle}>College / Library Location</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {collegeCoords ? (
                <Text style={[styles.statusBadge, styles.activeBadge]}>Monitored</Text>
              ) : (
                <Text style={[styles.statusBadge, styles.inactiveBadge]}>Not Set</Text>
              )}
              <Text style={{ color: COLORS.accent, fontSize: 10 }}>
                {activeLocationCard === "college" ? "▲" : "▼"}
              </Text>
            </View>
          </TouchableOpacity>
          
          {activeLocationCard === "college" ? (
            <View style={{ marginTop: 12 }}>
              <View style={styles.coordsDisplayRow}>
                <Text style={styles.coordsLabel}>Saved: </Text>
                <Text style={styles.coordsValue}>
                  {collegeCoords ? `${collegeCoords.latitude.toFixed(6)}, ${collegeCoords.longitude.toFixed(6)}` : "Not configured yet"}
                </Text>
              </View>

              <View style={styles.inputsRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Latitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={collegeLat}
                    onChangeText={setCollegeLat}
                    placeholder="e.g. 37.7749"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Longitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={collegeLon}
                    onChangeText={setCollegeLon}
                    placeholder="e.g. -122.4194"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.cardButtonSecondary}
                  onPress={() => handleGetCurrentLocation("college")}
                  disabled={saving !== null}
                >
                  <Text style={styles.buttonSecondaryText}>GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardButtonPrimary}
                  onPress={() => handleSaveLocation("college")}
                  disabled={saving !== null}
                >
                  {saving === "college" ? (
                    <ActivityIndicator size="small" color="#15161c" />
                  ) : (
                    <Text style={styles.buttonPrimaryText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardButtonAccent, !collegeCoords && styles.buttonDisabled]}
                  onPress={() => handleMockTrigger("college")}
                  disabled={!collegeCoords}
                >
                  <Text style={styles.buttonAccentText}>Mock Arrival</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            collegeCoords && (
              <Text style={styles.collapsedCoordsText}>
                Saved: {collegeCoords.latitude.toFixed(4)}, {collegeCoords.longitude.toFixed(4)}
              </Text>
            )
          )}
        </View>

        {/* HOME CARD */}
        <View style={styles.locationCard}>
          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => setActiveLocationCard(activeLocationCard === "home" ? null : "home")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🏠</Text>
              <Text style={styles.cardTitle}>Home Location</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {homeCoords ? (
                <Text style={[styles.statusBadge, styles.activeBadge]}>Monitored</Text>
              ) : (
                <Text style={[styles.statusBadge, styles.inactiveBadge]}>Not Set</Text>
              )}
              <Text style={{ color: COLORS.accent, fontSize: 10 }}>
                {activeLocationCard === "home" ? "▲" : "▼"}
              </Text>
            </View>
          </TouchableOpacity>
          
          {activeLocationCard === "home" ? (
            <View style={{ marginTop: 12 }}>
              <View style={styles.coordsDisplayRow}>
                <Text style={styles.coordsLabel}>Saved: </Text>
                <Text style={styles.coordsValue}>
                  {homeCoords ? `${homeCoords.latitude.toFixed(6)}, ${homeCoords.longitude.toFixed(6)}` : "Not configured yet"}
                </Text>
              </View>

              <View style={styles.inputsRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Latitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={homeLat}
                    onChangeText={setHomeLat}
                    placeholder="e.g. 37.7749"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Longitude</Text>
                  <TextInput
                    style={styles.textInput}
                    value={homeLon}
                    onChangeText={setHomeLon}
                    placeholder="e.g. -122.4194"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.cardButtonSecondary}
                  onPress={() => handleGetCurrentLocation("home")}
                  disabled={saving !== null}
                >
                  <Text style={styles.buttonSecondaryText}>GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardButtonPrimary}
                  onPress={() => handleSaveLocation("home")}
                  disabled={saving !== null}
                >
                  {saving === "home" ? (
                    <ActivityIndicator size="small" color="#15161c" />
                  ) : (
                    <Text style={styles.buttonPrimaryText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardButtonAccent, !homeCoords && styles.buttonDisabled]}
                  onPress={() => handleMockTrigger("home")}
                  disabled={!homeCoords}
                >
                  <Text style={styles.buttonAccentText}>Mock Arrival</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            homeCoords && (
              <Text style={styles.collapsedCoordsText}>
                Saved: {homeCoords.latitude.toFixed(4)}, {homeCoords.longitude.toFixed(4)}
              </Text>
            )
          )}
        </View>

        <Text style={styles.sectionTitle}>📅 My Fixed Routines</Text>
        <Text style={styles.sectionSubtitle}>
          Manage your fixed personal routine blocks (e.g. sleep buffers, meals, workouts). Your AI agent respects these when building daily timetables.
        </Text>

        <View style={styles.locationCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Routine Blocks ({fixedBlocks.length})</Text>
            <TouchableOpacity 
              style={[styles.statusBadge, styles.activeBadge]} 
              onPress={() => setShowAddForm(!showAddForm)}
            >
              <Text style={{ color: COLORS.accent, fontSize: 10, fontFamily: "monospace", fontWeight: "700" }}>
                {showAddForm ? "Close Form" : "+ Add Routine"}
              </Text>
            </TouchableOpacity>
          </View>

          {showAddForm && (
            <View style={styles.addFormContainer}>
              <Text style={styles.formSectionLabel}>Add New Fixed Routine</Text>
              
              <View style={styles.formInputGroup}>
                <Text style={styles.inputLabel}>Routine Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="e.g. Morning Workout, Dinner, Sleep Buffer"
                  placeholderTextColor={COLORS.textDim}
                />
              </View>

              <View style={styles.inputsRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Start Time (HH:MM)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newTime}
                    onChangeText={setNewTime}
                    placeholder="e.g. 07:30"
                    placeholderTextColor={COLORS.textDim}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Routine Type</Text>
                  <View style={styles.typeSelectorContainer}>
                    {["personal", "health", "rest", "ent", "study", "work"].map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.typeBadgeButton,
                          newType === t && { backgroundColor: TYPE_COLORS[t as keyof typeof TYPE_COLORS], borderColor: TYPE_COLORS[t as keyof typeof TYPE_COLORS] }
                        ]}
                        onPress={() => setNewType(t)}
                      >
                        <Text style={[styles.typeBadgeText, newType === t && { color: "#15161c" }]}>
                          {t.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>Active Days</Text>
              <View style={styles.daysSelectorRow}>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                  const shortDay = day.substring(0, 3);
                  const isSelected = newDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.daySelectorButton,
                        isSelected && styles.daySelectorButtonSelected
                      ]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.daySelectorText, isSelected && styles.daySelectorTextSelected]}>
                        {shortDay}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.submitFormButton} onPress={handleAddFixedBlock}>
                <Text style={styles.submitFormButtonText}>Save Routine Block</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List of existing blocks */}
          {fixedBlocks.length === 0 ? (
            <Text style={styles.emptyListText}>No fixed routine blocks registered. Add one above or tell the AI agent (e.g. "I go to gym at 6pm Mon, Wed, Fri").</Text>
          ) : (
            fixedBlocks.map((block, idx) => {
              const bgCol = TYPE_COLORS[block.type as keyof typeof TYPE_COLORS] || COLORS.muted;
              return (
                <View key={idx} style={[styles.routineCard, { borderLeftColor: bgCol }]}>
                  <View style={styles.routineInfoCol}>
                    <View style={styles.routineHeaderRow}>
                      <Text style={styles.routineTitle}>{block.title}</Text>
                      <View style={[styles.typeBadgeIndicator, { backgroundColor: bgCol + "1a", borderColor: bgCol, borderWidth: 1 }]}>
                        <Text style={[styles.typeBadgeIndicatorText, { color: bgCol }]}>{block.type}</Text>
                      </View>
                    </View>
                    <Text style={styles.routineTime}>{block.time} • {block.days?.map((d: string) => d.substring(0, 3)).join(", ")}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteRoutineButton} onPress={() => handleDeleteFixedBlock(idx)}>
                    <Text style={styles.deleteRoutineButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>📚 Academic Setup & Tracking</Text>
        <Text style={styles.sectionSubtitle}>
          Configure your college timetable, parse academic documents with Gemini, and track your syllabus progress.
        </Text>
        
        <View style={styles.academicToolsContainer}>
          {/* Card 1: Timetable */}
          <TouchableOpacity style={styles.toolCard} onPress={() => router.push("/timetable")}>
            <View style={styles.toolCardHeader}>
              <Text style={styles.toolCardTitle}>📅 Class Timetable</Text>
              <Text style={styles.toolCardArrow}>→</Text>
            </View>
            <Text style={styles.toolCardDescription}>View, add, or edit your weekly college lectures and classroom locations.</Text>
          </TouchableOpacity>

          {/* Card 2: Document Parser */}
          <TouchableOpacity style={styles.toolCard} onPress={() => router.push("/academics")}>
            <View style={styles.toolCardHeader}>
              <Text style={styles.toolCardTitle}>📸 Document Parser</Text>
              <Text style={styles.toolCardArrow}>→</Text>
            </View>
            <Text style={styles.toolCardDescription}>Upload a photo of your timetable or syllabus PDF to let Gemini extract details.</Text>
          </TouchableOpacity>

          {/* Card 3: Syllabus Tracker */}
          <TouchableOpacity style={styles.toolCard} onPress={() => router.push("/syllabus")}>
            <View style={styles.toolCardHeader}>
              <Text style={styles.toolCardTitle}>✍️ Syllabus Tracker</Text>
              <Text style={styles.toolCardArrow}>→</Text>
            </View>
            <Text style={styles.toolCardDescription}>Monitor completed units and remaining topics for exam preparation.</Text>
          </TouchableOpacity>
        </View>

        {/* SIGN OUT */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out Account</Text>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.muted,
    fontFamily: "monospace",
    fontSize: 13,
    marginTop: 12,
  },
  profileHeaderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.lavenderBg,
    borderWidth: 1.5,
    borderColor: COLORS.lavender,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    color: COLORS.lavender,
    fontSize: 24,
    fontWeight: "800",
  },
  headerInfo: {
    flex: 1,
  },
  emailText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  uidText: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  locationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  statusBadge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: "700",
    fontFamily: "monospace",
    overflow: "hidden",
  },
  activeBadge: {
    backgroundColor: "rgba(110, 231, 168, 0.1)",
    color: COLORS.green,
  },
  inactiveBadge: {
    backgroundColor: "rgba(107, 109, 125, 0.1)",
    color: COLORS.textMuted,
  },
  collapsedCoordsText: {
    color: COLORS.textDim,
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 8,
  },
  coordsDisplayRow: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: COLORS.bg,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  coordsLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: "monospace",
  },
  coordsValue: {
    color: COLORS.accent,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  inputsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginBottom: 6,
    fontFamily: "monospace",
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
    fontFamily: "monospace",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 10,
  },
  cardButtonSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonSecondaryText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  cardButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPrimaryText: {
    color: "#0c0e14",
    fontSize: 12,
    fontWeight: "700",
  },
  cardButtonAccent: {
    flex: 2.5,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonAccentText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(255, 79, 109, 0.05)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  signOutText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "700",
  },
  addFormContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 16,
    marginBottom: 16,
  },
  formSectionLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    marginBottom: 12,
  },
  formInputGroup: {
    marginBottom: 12,
  },
  typeSelectorContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  typeBadgeButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  daysSelectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 16,
  },
  daySelectorButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 8,
    width: "13%",
    alignItems: "center",
  },
  daySelectorButtonSelected: {
    backgroundColor: COLORS.accentBg,
    borderColor: COLORS.accent,
  },
  daySelectorText: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: "monospace",
  },
  daySelectorTextSelected: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  submitFormButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitFormButtonText: {
    color: "#0c0e14",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyListText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingVertical: 10,
  },
  routineItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  routineCard: {
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routineInfoCol: {
    flex: 1,
  },
  routineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routineTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  typeBadgeIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeIndicatorText: {
    color: "#0c0e14",
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  routineTime: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 4,
  },
  deleteRoutineButton: {
    padding: 8,
  },
  deleteRoutineButtonText: {
    fontSize: 14,
  },
  academicToolsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  toolCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  toolCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  toolCardTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  toolCardArrow: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  toolCardDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
