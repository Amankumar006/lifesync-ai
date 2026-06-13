import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { firestoreService } from "./firebase";

let Notifications: any = null;
try {
  Notifications = require("expo-notifications");
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (err) {
  console.warn("expo-notifications is not supported or failed to load in this environment:", err);
}

/**
 * Request push notification permissions and retrieve the Expo push token.
 * Returns the token string or null if permissions are denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) {
    console.warn("Push notifications are disabled (expo-notifications not available).");
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device.");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permissions not granted.");
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("schedule-reminders", {
      name: "Schedule Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00E5A0",
    });
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? "7e0b93ad-bd88-4567-8acb-f9599fba47aa";
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  console.info("Expo Push Token:", tokenData.data);
  return tokenData.data;
}

/**
 * Saves the push token to Firestore under users/{uid}.push_token
 * so the backend can read it when sending notifications.
 */
export async function savePushTokenToFirestore(
  uid: string,
  token: string
): Promise<void> {
  try {
    console.info(`Attempting to save push token for UID: "${uid}"`);
    await firestoreService.set(`users/${uid}`, {
      push_token: token,
      push_token_updated_at: new Date().toISOString(),
    });
    console.info(`Push token saved to Firestore for user ${uid}`);
  } catch (err) {
    console.error("Failed to save push token to Firestore:", err);
  }
}

/**
 * Convenience: register + save in one call. Call this after login.
 */
export async function setupPushNotifications(uid: string): Promise<string | null> {
  const token = await registerForPushNotifications();
  if (token) {
    await savePushTokenToFirestore(uid, token);
  }
  return token;
}

/**
 * Schedule a local notification (useful for testing without the backend sender).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  triggerSeconds: number
): Promise<string> {
  if (!Notifications) {
    console.warn("Local notifications are disabled (expo-notifications not available).");
    return "mock-notification-id";
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: "schedule_reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: triggerSeconds,
    },
  });
  console.info(`Local notification scheduled: ${title} in ${triggerSeconds}s (id: ${id})`);
  return id;
}
