import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { authService, firestoreService } from "../services/firebase";
import { COLORS } from "../constants/colors";
import { setupPushNotifications } from "../services/notifications";
import { setupGeofences } from "../hooks/useGeofence";

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle user state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((userState) => {
      setUser(userState);
      setInitializing(false);
      
      if (userState) {
        // Request notification permissions and register push token
        setupPushNotifications(userState.uid).catch((err) => {
          console.error("Error setting up push notifications on login:", err);
        });
      }
    });
    return unsubscribe;
  }, []);

  // Listen for location changes and initialize geofences
  useEffect(() => {
    if (!user) return;

    console.info(`Subscribing to locations for user: ${user.uid}`);
    const unsubscribe = firestoreService.onSnapshot(
      `users/${user.uid}`,
      (docSnap: any) => {
        if (docSnap && docSnap.exists()) {
          const userData = docSnap.data();
          const locations = userData?.locations;
          if (locations) {
            console.info("Locations loaded or updated:", JSON.stringify(locations));
            setupGeofences(locations).catch((err) => {
              console.error("Error updating geofences:", err);
            });
          } else {
            console.info("No locations found in user profile.");
          }
        }
      },
      (err: any) => {
        console.error("Error listening to user doc for geofencing:", err);
      }
    );

    return unsubscribe;
  }, [user]);

  const handleAuth = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await authService.createUserWithEmailAndPassword(email, password);
      } else {
        await authService.signInWithEmailAndPassword(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await authService.signInAnonymously();
    } catch (err: any) {
      setError(err.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Initializing Copilot...</Text>
      </View>
    );
  }

  // Auth Gate
  if (!user) {
    return (
      <View style={styles.authContainer}>
        <StatusBar style="light" />
        <View style={styles.glassCard}>
          <Text style={styles.title}>Personal</Text>
          <Text style={styles.subtitle}>AI Agent</Text>
          <Text style={styles.tagline}>Your intelligent scheduling co-pilot</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={COLORS.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{isSignUp ? "Create Account" : "Sign In"}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleDemoLogin} disabled={loading}>
            <Text style={styles.secondaryButtonText}>Try Demo Mode (Offline)</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleLink}>
            <Text style={styles.toggleLinkText}>
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render main app navigation if logged in
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="timetable"
          options={{
            headerShown: true,
            headerTitle: "Class Timetable",
            headerStyle: {
              backgroundColor: COLORS.surface,
            },
            headerTintColor: COLORS.accent,
            headerTitleStyle: {
              fontWeight: "700",
              color: COLORS.text,
              fontSize: 16,
            },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="academics"
          options={{
            headerShown: true,
            headerTitle: "Document Parser",
            headerStyle: {
              backgroundColor: COLORS.surface,
            },
            headerTintColor: COLORS.accent,
            headerTitleStyle: {
              fontWeight: "700",
              color: COLORS.text,
              fontSize: 16,
            },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="syllabus"
          options={{
            headerShown: true,
            headerTitle: "Syllabus Tracker",
            headerStyle: {
              backgroundColor: COLORS.surface,
            },
            headerTintColor: COLORS.accent,
            headerTitleStyle: {
              fontWeight: "700",
              color: COLORS.text,
              fontSize: 16,
            },
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 12,
    fontFamily: "monospace",
  },
  authContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  glassCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.accent,
    letterSpacing: -1,
    marginTop: -8,
  },
  tagline: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
    fontFamily: "monospace",
  },
  input: {
    width: "100%",
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 16,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#0c0e14",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 14,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "monospace",
  },
  toggleLink: {
    marginTop: 24,
  },
  toggleLinkText: {
    color: COLORS.muted,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
