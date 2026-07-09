import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, updateDoc, deleteDoc, Timestamp, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Safe messaging helper
export const getMessagingInstance = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getMessaging(app);
  }
  return null;
};

// Pre-initialize Firestore with robust settings suited for sandboxed iframes (long polling fallback)
const initializeDb = () => {
  const dbId = firebaseConfig.firestoreDatabaseId;
  console.log('[Firebase Init] Initializing Firestore with Database ID:', dbId);
  try {
    const dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
    console.log('[Firebase Init] Successfully initialized Firestore with experimentalForceLongPolling');
    return dbInstance;
  } catch (e) {
    console.warn('[Firebase Init] initializeFirestore failed, attempting getFirestore fallback. Error:', e);
    try {
      const dbInstance = getFirestore(app, dbId);
      console.log('[Firebase Init] Successfully obtained Firestore via getFirestore fallback');
      return dbInstance;
    } catch (err2) {
      console.error('[Firebase Init] getFirestore fallback failed. Error:', err2);
      try {
        console.warn('[Firebase Init] Attempting default getFirestore() as last resort');
        const dbInstance = getFirestore(app);
        console.log('[Firebase Init] Successfully obtained default Firestore instance');
        return dbInstance;
      } catch (err3) {
        console.error('[Firebase Init] Default getFirestore() failed. Error:', err3);
        throw err3;
      }
    }
  }
};

export const db = initializeDb();

// Enable offline persistence only when NOT inside a sandboxed iframe to prevent IndexedDB lockups in iframe environments
if (db && typeof window !== 'undefined' && window.self === window.top) {
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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
