import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, updateDoc, deleteDoc, Timestamp, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Safely extract config properties supporting potential bundler default wrapper variations
const getFirebaseConfig = () => {
  if (!firebaseConfig) return {} as any;
  if (typeof firebaseConfig === 'object' && 'default' in firebaseConfig) {
    return (firebaseConfig as any).default;
  }
  return firebaseConfig;
};

const safeConfig = getFirebaseConfig();
const app = initializeApp(safeConfig);
export const auth = getAuth(app);

// Safe messaging helper (permanently disabled for robust iframe operations)
export const getMessagingInstance = async () => {
  return null;
};

// Pre-initialize Firestore with robust settings suited for sandboxed iframes (long polling fallback)
const initializeDb = () => {
  const databaseId = safeConfig?.firestoreDatabaseId || undefined;
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  try {
    if (inIframe) {
      return initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      } as any, databaseId);
    } else {
      return getFirestore(app, databaseId);
    }
  } catch (e) {
    console.warn('[Firebase Init] initializeFirestore failed, falling back to getFirestore:', e);
    try {
      return getFirestore(app, databaseId);
    } catch (e2) {
      console.error('[Firebase Init] getFirestore with databaseId failed, trying fallback default:', e2);
      try {
        return getFirestore(app);
      } catch (e3) {
        console.error('[Firebase Init] Critical Failure - Default getFirestore(app) failed:', e3);
        throw e3;
      }
    }
  }
};

export const db = initializeDb();

// Enable offline persistence only when NOT inside a sandboxed iframe to prevent IndexedDB lockups in iframe environments
if (typeof window !== 'undefined' && window.self === window.top) {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/contacts.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Standard login
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      
      // Auto-cache Google Drive and Google Contacts tokens so users are linked instantly
      localStorage.setItem('ts_google_contacts_token', credential.accessToken);
      localStorage.setItem('ts_google_contacts_token_expiry', String(Date.now() + 3500 * 1000));
      localStorage.setItem('ts_google_drive_token', credential.accessToken);
      localStorage.setItem('ts_google_drive_token_expiry', String(Date.now() + 3500 * 1000));
      
      if (result.user.email) {
        localStorage.setItem('ts_google_contacts_email', result.user.email);
        localStorage.setItem('ts_google_drive_email', result.user.email);
        
        // Dispatch immediate events for UI update
        window.dispatchEvent(new Event('ts_contacts_email_changed'));
        window.dispatchEvent(new Event('ts_drive_email_changed'));
      }
    }
    return result.user;
  } catch (error: any) {
    console.error("Login failed:", error);
    const code = error?.code || "";
    if (code === "auth/popup-closed-by-user") {
      throw new Error("popup-closed-by-user");
    } else if (code === "auth/popup-blocked") {
      throw new Error("popup-blocked");
    }
    throw error;
  }
};

// Connection checks and listeners are deferred to real user actions to prevent unauthenticated startup exceptions.

export { onAuthStateChanged };
export type { User };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOffline = errMsg.toLowerCase().includes('offline') || errMsg.toLowerCase().includes('unavailable');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
          })) || []
    },
    operationType,
    path
  };
  
  if (isOffline) {
    console.warn('Firestore Info (Offline fallback): ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return null as any;
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as any;
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }
  return result;
}
