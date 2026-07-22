import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, updateDoc, deleteDoc, Timestamp, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize messaging lazily and check for support
export const getFCMToken = async (vapidKey: string): Promise<string | null> => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM is not supported in this browser environment.");
      return null;
    }
    const messaging = getMessaging(app);
    
    // Request permission first
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error("Notification permission denied");
    }
    
    // Explicitly register the unified Service Worker to handle PWA caching and FCM cleanly
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('/sw.js');
      console.log("FCM Service Worker (/sw.js) registered successfully:", registration);
      
      // Wait for the service worker to become fully active to prevent subscription failures
      if (!registration.active) {
        console.log("Service worker is not active yet. Waiting for activation...");
        await new Promise<void>((resolve) => {
          const sw = registration!.installing || registration!.waiting;
          if (sw) {
            const handler = (e: any) => {
              if (e.target.state === 'activated') {
                sw.removeEventListener('statechange', handler);
                console.log("Service Worker activated successfully via event.");
                resolve();
              }
            };
            sw.addEventListener('statechange', handler);
          } else {
            resolve();
          }
          // Fallback timeout after 3 seconds
          setTimeout(resolve, 3000);
        });
      }
      
      // Double check that the Service Worker is ready
      await navigator.serviceWorker.ready;
    } else {
      throw new Error("Service workers are not supported by this browser.");
    }
    
    // Get token using the registered service worker reference
    const token = await getToken(messaging, { 
      vapidKey,
      serviceWorkerRegistration: registration
    });
    return token;
  } catch (error) {
    console.error("Error retrieving FCM token:", error);
    throw error;
  }
};

export const onMessageReceived = async (callback: (payload: any) => void) => {
  const supported = await isSupported();
  if (!supported) return () => {};
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
};

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

export const googleProvider = new GoogleAuthProvider();

// Standard login
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

// Sync connection test as required by instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export { onAuthStateChanged };
export type { User };
