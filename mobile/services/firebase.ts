import * as FileSystem from "expo-file-system/legacy";

const SESSION_FILE = `${FileSystem.documentDirectory}mock_user_session.json`;

// Mock services for local development and Expo Go runtime environments
class MockAuth {
  private user: any = null;
  private listeners: Array<(user: any) => void> = [];
  private isInitialized = false;

  constructor() {
    this.loadSession();
  }

  private async loadSession() {
    try {
      const info = await FileSystem.getInfoAsync(SESSION_FILE);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(SESSION_FILE);
        this.user = JSON.parse(content);
        console.info("Restored mock auth session:", this.user);
      } else {
        console.info("No saved mock auth session found.");
      }
    } catch (e) {
      console.warn("Failed to load persistent mock session:", e);
    } finally {
      this.isInitialized = true;
      this.notify();
    }
  }

  private async saveSession() {
    try {
      if (this.user) {
        await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(this.user));
      } else {
        const info = await FileSystem.getInfoAsync(SESSION_FILE);
        if (info.exists) {
          await FileSystem.deleteAsync(SESSION_FILE);
        }
      }
    } catch (e) {
      console.warn("Failed to save persistent mock session:", e);
    }
  }

  get currentUser() {
    return this.user;
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    // Trigger callback with current user immediately if loaded
    if (this.isInitialized) {
      setTimeout(() => callback(this.user), 0);
    }
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  async signInAnonymously() {
    this.user = { uid: "demo_anonymous", email: "demo@agentcopilot.ai" };
    await this.saveSession();
    this.notify();
    return { user: this.user };
  }

  async signInWithEmailAndPassword(email: string, _: string) {
    const cleanId = email.replace(/[^a-zA-Z0-9]/g, "_");
    this.user = { uid: cleanId, email };
    await this.saveSession();
    this.notify();
    return { user: this.user };
  }

  async createUserWithEmailAndPassword(email: string, _: string) {
    const cleanId = email.replace(/[^a-zA-Z0-9]/g, "_");
    this.user = { uid: cleanId, email };
    await this.saveSession();
    this.notify();
    return { user: this.user };
  }

  async signOut() {
    this.user = null;
    await this.saveSession();
    this.notify();
  }

  async getIdToken() {
    return "mock-dev-token-jwt";
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.user));
  }
}

class MockFirestore {
  private storage: Record<string, any> = {};
  private listeners: Record<string, Set<(data: any) => void>> = {};

  async set(path: string, data: any) {
    console.info(`Firestore Dev Mock: Set document '${path}' to:`, data);
    this.storage[path] = { ...this.storage[path], ...data };
    this.notify(path);
    return true;
  }

  async update(path: string, data: any) {
    console.info(`Firestore Dev Mock: Updated document '${path}' with data:`, data);
    this.storage[path] = { ...this.storage[path], ...data };
    this.notify(path);
    return true;
  }

  async get(path: string) {
    return {
      exists: () => !!this.storage[path],
      data: () => this.storage[path]
    };
  }

  async add(collectionPath: string, data: any) {
    const id = Math.random().toString(36).substring(7);
    const docPath = `${collectionPath}/${id}`;
    this.storage[docPath] = { ...data, id };
    this.notify(collectionPath);
    return { id };
  }

  async delete(docPath: string) {
    console.info(`Firestore Dev Mock: Deleting document '${docPath}'`);
    delete this.storage[docPath];
    const parts = docPath.split("/");
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join("/");
      this.notify(parentPath);
    }
    return true;
  }

  onSnapshot(path: string, onNext: (data: any) => void, onError?: (err: any) => void) {
    console.info(`Firestore Dev Mock: Listening to '${path}'`);
    if (!this.listeners[path]) {
      this.listeners[path] = new Set();
    }
    this.listeners[path].add(onNext);

    const emit = () => {
      const parts = path.split("/");
      if (parts.length % 2 === 1) {
        // Listening to a collection, e.g. "tasks/uid/items"
        const list: any[] = [];
        const prefix = path + "/";
        Object.keys(this.storage).forEach(k => {
          if (k.startsWith(prefix)) {
            const docId = k.substring(prefix.length);
            if (!docId.includes("/")) {
              list.push({ id: docId, ...this.storage[k] });
            }
          }
        });
        onNext(list);
      } else {
        // Listening to a document, e.g. "timetables/uid"
        onNext({
          exists: () => !!this.storage[path],
          data: () => this.storage[path]
        });
      }
    };

    const timer = setTimeout(emit, 100);

    return () => {
      if (this.listeners[path]) {
        this.listeners[path].delete(onNext);
      }
      clearTimeout(timer);
    };
  }

  private notify(path: string) {
    if (this.listeners[path]) {
      this.listeners[path].forEach(cb => {
        cb({
          exists: () => !!this.storage[path],
          data: () => this.storage[path]
        });
      });
    }
    const parts = path.split("/");
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join("/");
      if (this.listeners[parentPath]) {
        const list: any[] = [];
        const prefix = parentPath + "/";
        Object.keys(this.storage).forEach(k => {
          if (k.startsWith(prefix)) {
            const docId = k.substring(prefix.length);
            if (!docId.includes("/")) {
              list.push({ id: docId, ...this.storage[k] });
            }
          }
        });
        this.listeners[parentPath].forEach(cb => cb(list));
      }
    }
  }
}

let authService: any = new MockAuth();
let firestoreService: any = new MockFirestore();

// Attempt to resolve native React Native Firebase modules if available
try {
  const auth = require("@react-native-firebase/auth").default;
  const firestore = require("@react-native-firebase/firestore").default;

  const authInstance = auth();
  const firestoreInstance = firestore();

  authService = {
    get currentUser() {
      return authInstance.currentUser;
    },
    onAuthStateChanged(callback: any) {
      return authInstance.onAuthStateChanged(callback);
    },
    signInAnonymously() {
      return authInstance.signInAnonymously();
    },
    signInWithEmailAndPassword(e: string, p: string) {
      return authInstance.signInWithEmailAndPassword(e, p);
    },
    createUserWithEmailAndPassword(e: string, p: string) {
      return authInstance.createUserWithEmailAndPassword(e, p);
    },
    signOut() {
      return authInstance.signOut();
    },
    getIdToken() {
      return authInstance.currentUser ? authInstance.currentUser.getIdToken() : Promise.resolve("mock-token");
    }
  };

  firestoreService = {
    async set(path: string, data: any) {
      const parts = path.split("/");
      let docRef: any;
      if (parts.length === 2) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]);
      } else if (parts.length === 4) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]).collection(parts[2]).doc(parts[3]);
      } else {
        throw new Error(`Invalid document path for set: ${path}`);
      }
      return docRef.set(data, { merge: true });
    },
    async update(path: string, data: any) {
      const parts = path.split("/");
      let docRef: any;
      if (parts.length === 2) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]);
      } else if (parts.length === 4) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]).collection(parts[2]).doc(parts[3]);
      } else {
        throw new Error(`Invalid document path for update: ${path}`);
      }
      return docRef.update(data);
    },
    async get(path: string) {
      const parts = path.split("/");
      let docRef: any;
      if (parts.length === 2) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]);
      } else if (parts.length === 4) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]).collection(parts[2]).doc(parts[3]);
      } else {
        throw new Error(`Invalid document path for get: ${path}`);
      }
      const snap = await docRef.get();
      return {
        exists: () => snap.exists,
        data: () => snap.data()
      };
    },
    async add(collectionPath: string, data: any) {
      const parts = collectionPath.split("/");
      let colRef: any;
      if (parts.length === 1) {
        colRef = firestoreInstance.collection(parts[0]);
      } else if (parts.length === 3) {
        colRef = firestoreInstance.collection(parts[0]).doc(parts[1]).collection(parts[2]);
      } else {
        throw new Error(`Invalid collection path for add: ${collectionPath}`);
      }
      const docRef = await colRef.add(data);
      return { id: docRef.id };
    },
    async delete(docPath: string) {
      const parts = docPath.split("/");
      let docRef: any;
      if (parts.length === 2) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]);
      } else if (parts.length === 4) {
        docRef = firestoreInstance.collection(parts[0]).doc(parts[1]).collection(parts[2]).doc(parts[3]);
      } else {
        throw new Error(`Invalid document path for delete: ${docPath}`);
      }
      return docRef.delete();
    },
    onSnapshot(path: string, onNext: any, onError: any) {
      const parts = path.split("/");
      if (parts.length % 2 === 1) {
        let queryRef: any;
        if (parts.length === 3) {
          queryRef = firestoreInstance.collection(parts[0]).doc(parts[1]).collection(parts[2]);
        } else {
          queryRef = firestoreInstance.collection(parts[0]);
        }
        return queryRef.onSnapshot(
          (querySnapshot: any) => {
            const list: any[] = [];
            querySnapshot.forEach((doc: any) => {
              list.push({ id: doc.id, ...doc.data() });
            });
            onNext(list);
          },
          onError
        );
      } else {
        let docRef: any;
        if (parts.length === 2) {
          docRef = firestoreInstance.collection(parts[0]).doc(parts[1]);
        } else if (parts.length === 4) {
          docRef = firestoreInstance.collection(parts[0]).doc(parts[1]).collection(parts[2]).doc(parts[3]);
        } else {
          throw new Error(`Invalid document path for onSnapshot: ${path}`);
        }
        return docRef.onSnapshot(
          (snap: any) => {
            onNext({
              exists: () => snap.exists,
              data: () => snap.data()
            });
          },
          onError
        );
      }
    }
  };
  console.info("Native Firebase React Native SDK linked successfully.");
} catch (e) {
  console.info("Firebase Native SDK not available. Using local client Mock services.");
  console.info("Firebase Native SDK load error (expected in Expo Go):", e);
}

export { authService, firestoreService };
