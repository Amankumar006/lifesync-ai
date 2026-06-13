import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSchedule, ScheduleBlock } from "../../hooks/useSchedule";
import { COLORS, TYPE_COLORS } from "../../constants/colors";

// Build a label like "Mon, Jun 9" for a date offset
function getDayLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getDateKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ScheduleScreen() {
  const [selectedOffset, setSelectedOffset] = useState(0);
  const dateKey = getDateKey(selectedOffset);
  const { schedule, loading, currentMode, toggleMode, updateBlockStatus } = useSchedule(dateKey);

  const renderScheduleBlock = (item: any, index: number) => {
    const color = TYPE_COLORS[item.type as keyof typeof TYPE_COLORS] ?? COLORS.muted;
    return (
      <View style={[styles.blockCard, { borderLeftColor: color }]}>
        <View style={styles.blockTimeCol}>
          <Text style={styles.blockTime}>{item.time}</Text>
          <View style={[styles.dotIndicator, { backgroundColor: color }]} />
        </View>
        
        <View style={styles.blockContent}>
          <View style={styles.titleRow}>
            <Text style={styles.blockTitle}>{item.title}</Text>
            <View style={[styles.typeBadge, { borderColor: color + "40" }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{item.type.toUpperCase()}</Text>
            </View>
          </View>
          {item.notes ? <Text style={styles.blockNotes}>{item.notes}</Text> : null}

          {/* Completion tracking status/controls */}
          <View style={styles.statusRow}>
            {item.completed ? (
              <TouchableOpacity style={styles.completedBadge} onPress={() => updateBlockStatus(index, "none")}>
                <Text style={styles.completedBadgeText}>✓ Completed</Text>
              </TouchableOpacity>
            ) : item.skipped ? (
              <TouchableOpacity style={styles.skippedBadge} onPress={() => updateBlockStatus(index, "none")}>
                <Text style={styles.skippedBadgeText}>✗ Skipped</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.doneBtn} onPress={() => updateBlockStatus(index, "completed")}>
                  <Text style={styles.doneBtnText}>✓ Done</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={() => updateBlockStatus(index, "skipped")}>
                  <Text style={styles.skipBtnText}>✗ Skip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.blockDuration}>{item.duration_min} min</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Subheader Day Selector — Yesterday / Today / Tomorrow */}
      <View style={styles.daySelector}>
        {([-1, 0, 1] as const).map((offset) => (
          <TouchableOpacity
            key={offset}
            style={[styles.dayTab, selectedOffset === offset ? styles.activeDayTab : null]}
            onPress={() => setSelectedOffset(offset)}
          >
            <Text style={[styles.dayTabText, selectedOffset === offset ? styles.activeDayTabText : null]}>
              {offset === 0 ? "Today" : getDayLabel(offset)}
            </Text>
            <Text style={[styles.dayTabDate, selectedOffset === offset ? { color: COLORS.accent } : null]}>
              {getDateKey(offset)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mode Status Header */}
      <View style={styles.modeCard}>
        <View style={styles.modeInfo}>
          <Text style={styles.modeLabel}>Active Routine Mode</Text>
          <Text style={styles.modeValue}>
            {currentMode === "weekday" ? "💼 Weekday Routine" : "🌴 Weekend Relaxation"}
          </Text>
        </View>
        <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
          <Text style={styles.toggleButtonText}>Switch Mode</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Building your schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={schedule}
          renderItem={({ item, index }) => renderScheduleBlock(item, index)}
          keyExtractor={(item, index) => item.id || `${item.time}-${index}`}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <Text style={styles.listDateHeader}>{getDayLabel(selectedOffset)} — {dateKey}</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No schedule yet for {dateKey}.</Text>
              <Text style={styles.emptySubtext}>Ask your AI Co-pilot to generate one!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  daySelector: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  dayTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  activeDayTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  dayTabText: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: "monospace",
  },
  activeDayTabText: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  dayTabDate: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: "monospace",
    marginTop: 2,
  },
  modeCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    margin: 16,
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeInfo: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  modeValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toggleButtonText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  listDateHeader: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  blockCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  blockTimeCol: {
    alignItems: "center",
    marginRight: 16,
    width: 48,
  },
  blockTime: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  blockContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  blockTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "700",
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: "700",
  },
  blockNotes: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
  blockDuration: {
    fontSize: 11,
    color: COLORS.muted,
    fontFamily: "monospace",
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
    fontFamily: "monospace",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  emptySubtext: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center",
  },
  completedBadge: {
    backgroundColor: "rgba(0, 229, 160, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  skippedBadge: {
    backgroundColor: "rgba(255, 79, 109, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skippedBadgeText: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  doneBtn: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(0, 229, 160, 0.03)",
  },
  doneBtnText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 79, 109, 0.03)",
  },
  skipBtnText: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
  },
});
