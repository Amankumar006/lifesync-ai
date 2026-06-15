import { Tabs, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Platform, TouchableOpacity, Text } from "react-native";
import { COLORS } from "../../constants/colors";
import {
  ChatIcon,
  PlanIcon,
  TasksIcon,
  NotesIcon,
  ProfileIcon
} from "../../components/icons";

export default function TabLayout() {
  const router = useRouter();
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
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "monospace",
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "AI Co-pilot",
          headerTitle: "🧠 Agent Chat",
          tabBarLabel: "Chat",
          tabBarIcon: ({ focused }) => <ChatIcon size={24} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          headerTitle: "📅 Daily Schedule",
          tabBarLabel: "Plan",
          tabBarIcon: ({ size, focused }) => <PlanIcon size={24} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          headerTitle: "📋 Tasks Tracker",
          tabBarLabel: "Tasks",
          tabBarIcon: ({ focused }) => <TasksIcon size={24} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          headerTitle: "📝 Notes Keeper",
          tabBarLabel: "Notes",
          tabBarIcon: ({ focused }) => <NotesIcon size={24} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerTitle: "👤 User Profile",
          tabBarLabel: "You",
          tabBarIcon: ({ focused }) => <ProfileIcon size={24} active={focused} />,
        }}
      />
      
    </Tabs>
  );
}
