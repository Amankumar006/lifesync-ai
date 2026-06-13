import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, Platform } from "react-native";
import { COLORS } from "../../constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        },
        headerTitleStyle: {
          fontWeight: "700",
          color: COLORS.text,
          fontSize: 16,
          fontFamily: Platform.OS === "ios" ? "System" : "monospace",
        },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "monospace",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "AI Co-pilot",
          headerTitle: "🧠 Agent Chat",
          tabBarLabel: "Chat",
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          headerTitle: "📅 Daily Schedule",
          tabBarLabel: "Schedule",
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: "Timetable",
          headerTitle: "🎓 College Timetable",
          tabBarLabel: "Timetable",
        }}
      />
      <Tabs.Screen
        name="academics"
        options={{
          title: "Academics",
          headerTitle: "📚 Academics & Docs",
          tabBarLabel: "Academics",
        }}
      />
      <Tabs.Screen
        name="syllabus"
        options={{
          title: "Syllabus",
          headerTitle: "📝 Syllabus Tracker",
          tabBarLabel: "Syllabus",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerTitle: "👤 User Profile",
          tabBarLabel: "Profile",
        }}
      />
    </Tabs>
  );
}
